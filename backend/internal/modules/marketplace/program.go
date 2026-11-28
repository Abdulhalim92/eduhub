package marketplace

import (
	"context"
	"fmt"
	"strings"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// Caller — кто обращается к курсу: SuperAdmin (платформа) или администратор центра (его тенант).
type Caller struct {
	CenterID   *int64
	SuperAdmin bool
}

func (c Caller) owns(course *Course) bool {
	return c.CenterID != nil && course.OwnerCenterID != nil && *course.OwnerCenterID == *c.CenterID
}

// authorizeCourse повторяет courseFor из api.js: платформа правит платформенные курсы, центр — свои;
// чтение купленного курса доступно центру с активным доступом (BR-016).
func (s *Service) authorizeCourse(ctx context.Context, tx *gorm.DB, course *Course, caller Caller, write bool) error {
	if caller.CenterID != nil {
		own := caller.owns(course)
		if write {
			if !own {
				return apierr.New(apierr.CodeForbidden, "Править можно только собственные курсы центра")
			}
			return nil
		}
		if own {
			return nil
		}
		a, err := s.repo.ActiveAccessTx(ctx, tx, *caller.CenterID, course.ID)
		if err != nil {
			return err
		}
		if a == nil {
			return apierr.New(apierr.CodeForbidden, "У центра нет доступа к этому курсу")
		}
		return nil
	}
	// SuperAdmin: только платформенные курсы.
	if !course.IsPlatform() {
		return apierr.New(apierr.CodeForbidden, "Это собственный курс центра: управлять им может только центр")
	}
	return nil
}

func (s *Service) pageDTO(ctx context.Context, course *Course, caller Caller) (CoursePage, error) {
	cdto, err := s.courseDTO(ctx, *course)
	if err != nil {
		return CoursePage{}, err
	}
	page := CoursePage{Course: cdto, Content: course.Content}
	switch {
	case caller.CenterID == nil:
		page.Kind, page.CanEdit = "platform", true
	case caller.owns(course):
		page.Kind, page.CanEdit = "own", true
	default:
		page.Kind, page.CanEdit = "purchased", false
		if a, err := s.repo.ActiveAccess(ctx, *caller.CenterID, course.ID); err == nil && a != nil {
			dto, err := s.accessDTO(ctx, *a, &cdto)
			if err != nil {
				return CoursePage{}, err
			}
			page.Access = &dto
		}
	}
	return page, nil
}

// GetCourse возвращает страницу курса (courses.get).
func (s *Service) GetCourse(ctx context.Context, id int64, caller Caller) (CoursePage, error) {
	course, err := s.repo.Course(ctx, id)
	if err != nil {
		return CoursePage{}, err
	}
	if err := s.authorizeCourse(ctx, s.db, course, caller, false); err != nil {
		return CoursePage{}, err
	}
	return s.pageDTO(ctx, course, caller)
}

// UpdateCourse меняет название/направление/описание (PLT-MKT-020).
func (s *Service) UpdateCourse(ctx context.Context, actor audit.Actor, id int64, caller Caller, title, direction, description string) (CoursePage, error) {
	var page CoursePage
	err := s.db.Transaction(func(tx *gorm.DB) error {
		course, err := s.repo.CourseTx(ctx, tx, id, true)
		if err != nil {
			return err
		}
		if err := s.authorizeCourse(ctx, tx, course, caller, true); err != nil {
			return err
		}
		title = strings.TrimSpace(title)
		fields := map[string]string{}
		if n := len([]rune(title)); n < 3 || n > 80 {
			fields["title"] = "Название — от 3 до 80 символов"
		} else {
			var exists bool
			if course.IsPlatform() {
				exists, err = s.repo.PlatformTitleExists(ctx, title, course.ID)
			} else {
				exists, err = s.repo.CenterTitleExists(ctx, *course.OwnerCenterID, title, course.ID)
			}
			if err != nil {
				return err
			}
			if exists {
				fields["title"] = "Курс с таким названием уже есть"
			}
		}
		if !contains(courseDirections, direction) {
			fields["direction"] = "Выберите направление"
		}
		if len([]rune(description)) > 600 {
			fields["description"] = "Описание — не длиннее 600 символов"
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные курса", fields)
		}
		course.Title, course.Direction, course.Description = title, direction, strings.TrimSpace(description)
		if err := s.repo.SaveCourse(ctx, tx, course); err != nil {
			return err
		}
		if course.IsPlatform() {
			cid, name := courseEntity(course)
			if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.updated", EntityType: "course", EntityID: cid, EntityName: name, Reason: "Изменены данные курса"}); err != nil {
				return err
			}
		}
		page, err = s.pageDTO(ctx, course, caller)
		return err
	})
	return page, err
}

// editContent — общий каркас правки программы: загрузка с блокировкой, авторизация, мутация, аудит.
func (s *Service) editContent(ctx context.Context, actor audit.Actor, id int64, caller Caller, mutate func(c *Course) error, logText string) (CoursePage, error) {
	var page CoursePage
	err := s.db.Transaction(func(tx *gorm.DB) error {
		course, err := s.repo.CourseTx(ctx, tx, id, true)
		if err != nil {
			return err
		}
		if err := s.authorizeCourse(ctx, tx, course, caller, true); err != nil {
			return err
		}
		if err := mutate(course); err != nil {
			return err
		}
		if err := s.repo.SaveCourse(ctx, tx, course); err != nil {
			return err
		}
		if course.IsPlatform() && logText != "" {
			cid, name := courseEntity(course)
			if err := s.audit.Log(ctx, tx, audit.Event{Actor: actor, Action: "course.content", EntityType: "course", EntityID: cid, EntityName: name, Reason: logText}); err != nil {
				return err
			}
		}
		page, err = s.pageDTO(ctx, course, caller)
		return err
	})
	return page, err
}

func checkTitle(t string, min, max int) (string, error) {
	t = strings.TrimSpace(t)
	if n := len([]rune(t)); n < min || n > max {
		return "", apierr.Field(fmt.Sprintf("Название — от %d до %d символов", min, max), "title", fmt.Sprintf("От %d до %d символов", min, max))
	}
	return t, nil
}

// AddModule добавляет модуль.
func (s *Service) AddModule(ctx context.Context, actor audit.Actor, id int64, caller Caller, title string) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		t, err := checkTitle(title, 2, 80)
		if err != nil {
			return err
		}
		c.AddModule(t)
		return nil
	}, "Добавлен модуль «"+strings.TrimSpace(title)+"»")
}

// RenameModule переименовывает модуль.
func (s *Service) RenameModule(ctx context.Context, actor audit.Actor, id, moduleID int64, caller Caller, title string) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		t, err := checkTitle(title, 2, 80)
		if err != nil {
			return err
		}
		m := c.findModule(moduleID)
		if m == nil {
			return apierr.NotFound("Модуль не найден")
		}
		m.Title = t
		return nil
	}, "Модуль переименован")
}

// RemoveModule удаляет модуль с содержимым.
func (s *Service) RemoveModule(ctx context.Context, actor audit.Actor, id, moduleID int64, caller Caller) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		if !c.RemoveModule(moduleID) {
			return apierr.NotFound("Модуль не найден")
		}
		return nil
	}, "Удалён модуль")
}

// AddLesson добавляет урок в модуль.
func (s *Service) AddLesson(ctx context.Context, actor audit.Actor, id, moduleID int64, caller Caller, title string) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		t, err := checkTitle(title, 2, 100)
		if err != nil {
			return err
		}
		if _, ok := c.AddLesson(moduleID, t); !ok {
			return apierr.NotFound("Модуль не найден")
		}
		return nil
	}, "Добавлен урок")
}

// RenameLesson переименовывает урок.
func (s *Service) RenameLesson(ctx context.Context, actor audit.Actor, id, lessonID int64, caller Caller, title string) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		t, err := checkTitle(title, 2, 100)
		if err != nil {
			return err
		}
		l, _ := c.findLesson(lessonID)
		if l == nil {
			return apierr.NotFound("Урок не найден")
		}
		l.Title = t
		return nil
	}, "Переименован урок")
}

// RemoveLesson удаляет урок.
func (s *Service) RemoveLesson(ctx context.Context, actor audit.Actor, id, lessonID int64, caller Caller) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		if !c.RemoveLesson(lessonID) {
			return apierr.NotFound("Урок не найден")
		}
		return nil
	}, "Удалён урок")
}

// AddMaterial добавляет материал в урок. type: plan|video|pdf|slides|test.
func (s *Service) AddMaterial(ctx context.Context, actor audit.Actor, id, lessonID int64, caller Caller, matType, name string, questions int) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		fields := map[string]string{}
		if !materialTypes[matType] {
			fields["type"] = "Выберите тип материала"
		}
		n := strings.TrimSpace(name)
		if r := len([]rune(n)); r < 2 || r > 100 {
			fields["name"] = "Название — от 2 до 100 символов"
		}
		if matType == "test" && (questions < 1 || questions > 100) {
			fields["questions"] = "Число вопросов — от 1 до 100"
		}
		if len(fields) > 0 {
			return apierr.Validation("Проверьте данные материала", fields)
		}
		c.AddMaterial(lessonID, matType, n, materialSize(c, matType, questions))
		return nil
	}, "Добавлен материал")
}

// RemoveMaterial удаляет материал.
func (s *Service) RemoveMaterial(ctx context.Context, actor audit.Actor, id, materialID int64, caller Caller) (CoursePage, error) {
	return s.editContent(ctx, actor, id, caller, func(c *Course) error {
		if !c.RemoveMaterial(materialID) {
			return apierr.NotFound("Материал не найден")
		}
		return nil
	}, "Удалён материал")
}

// materialSize имитирует размер файла (как в прототипе): тест — число вопросов, иначе условный размер.
func materialSize(c *Course, matType string, questions int) string {
	switch matType {
	case "test":
		return fmt.Sprintf("%d вопросов", questions)
	case "video":
		return fmt.Sprintf("%d МБ", 10+int(c.ContentSeq%70))
	default:
		return fmt.Sprintf("%d,%d МБ", 1+int(c.ContentSeq%4), int(c.ContentSeq%9))
	}
}
