package journal

import (
	"context"
	"time"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

// StartShiftRequest — тело начала смены (гео-чек-ин, LRN-TCH-010).
type StartShiftRequest struct {
	TeacherID int64   `json:"teacherId"`
	Branch    string  `json:"branch"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
}

// ShiftDTO — смена преподавателя.
type ShiftDTO struct {
	ID         int64      `json:"id"`
	TeacherID  int64      `json:"teacherId"`
	Branch     string     `json:"branch"`
	StartedAt  time.Time  `json:"startedAt"`
	EndedAt    *time.Time `json:"endedAt"`
	GeoChecked bool       `json:"geoChecked"`
}

// StartShift начинает смену преподавателя с проверкой гео-радиуса от филиала (LRN-TCH-010).
func (s *Service) StartShift(ctx context.Context, actor audit.Actor, centerID int64, req StartShiftRequest) (ShiftDTO, error) {
	var out ShiftDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		center, err := s.repo.Center(ctx, tx, centerID)
		if err != nil {
			return err
		}
		if err := writable(center, "начинать смену"); err != nil {
			return err
		}
		if ok, err := s.repo.TeacherExists(ctx, tx, centerID, req.TeacherID); err != nil {
			return err
		} else if !ok {
			return apierr.Field("Выберите преподавателя центра", "teacherId", "Неизвестный преподаватель")
		}
		geoChecked := false
		if lat, lng, ok, err := s.repo.BranchCoords(ctx, centerID, req.Branch); err != nil {
			return err
		} else if ok {
			geoChecked = true
			if distanceMeters(req.Lat, req.Lng, lat, lng) > shiftRadiusMeters {
				return apierr.Conflict("Вы вне радиуса филиала: начать смену можно рядом с местом работы")
			}
		}
		sh := &TeacherShift{CenterID: centerID, TeacherID: req.TeacherID, Branch: req.Branch, StartedAt: time.Now().UTC(), GPSLat: req.Lat, GPSLng: req.Lng}
		if err := s.repo.CreateShift(ctx, tx, sh); err != nil {
			return err
		}
		if err := s.audit.Log(ctx, tx, audit.Event{
			Actor: actor, Action: "shift.started", EntityType: "center", EntityID: itoa(centerID), EntityName: center.Name,
			After: map[string]any{"teacher": req.TeacherID, "branch": req.Branch, "geoChecked": geoChecked}, Reason: "Начата смена преподавателя",
		}); err != nil {
			return err
		}
		out = ShiftDTO{ID: sh.ID, TeacherID: sh.TeacherID, Branch: sh.Branch, StartedAt: sh.StartedAt, GeoChecked: geoChecked}
		return nil
	})
	return out, err
}

// EndShift завершает смену.
func (s *Service) EndShift(ctx context.Context, centerID, shiftID int64) (ShiftDTO, error) {
	var out ShiftDTO
	err := s.db.Transaction(func(tx *gorm.DB) error {
		sh, err := s.repo.FindShift(ctx, tx, centerID, shiftID)
		if err != nil {
			return err
		}
		if sh.EndedAt == nil {
			now := time.Now().UTC()
			sh.EndedAt = &now
			if err := s.repo.SaveShift(ctx, tx, sh); err != nil {
				return err
			}
		}
		out = ShiftDTO{ID: sh.ID, TeacherID: sh.TeacherID, Branch: sh.Branch, StartedAt: sh.StartedAt, EndedAt: sh.EndedAt, GeoChecked: true}
		return nil
	})
	return out, err
}
