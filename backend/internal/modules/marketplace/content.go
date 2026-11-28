package marketplace

import "strings"

// Операции над программой курса (дерево модули→уроки→материалы). Чистые функции над Course:
// меняют Content/ContentSeq/счётчики в памяти; сохранение — в репозитории.

// nextID выдаёт следующий id узла программы и увеличивает счётчик курса.
func (c *Course) nextID() int64 {
	if c.ContentSeq < 1 {
		c.ContentSeq = 1
	}
	id := c.ContentSeq
	c.ContentSeq++
	return id
}

// recount пересчитывает число уроков и тестов из программы (кэш в колонках).
func (c *Course) recount() {
	lessons, tests := 0, 0
	for _, m := range c.Content.Modules {
		for _, l := range m.Lessons {
			lessons++
			for _, mat := range l.Materials {
				if mat.Type == "test" {
					tests++
				}
			}
		}
	}
	c.Lessons = lessons
	c.Tests = tests
}

func (c *Course) findModule(id int64) *Module {
	for i := range c.Content.Modules {
		if c.Content.Modules[i].ID == id {
			return &c.Content.Modules[i]
		}
	}
	return nil
}

// findLesson возвращает урок и модуль, в котором он лежит.
func (c *Course) findLesson(id int64) (*Lesson, *Module) {
	for mi := range c.Content.Modules {
		m := &c.Content.Modules[mi]
		for li := range m.Lessons {
			if m.Lessons[li].ID == id {
				return &m.Lessons[li], m
			}
		}
	}
	return nil, nil
}

// AddModule добавляет модуль и возвращает его id.
func (c *Course) AddModule(title string) int64 {
	id := c.nextID()
	c.Content.Modules = append(c.Content.Modules, Module{ID: id, Title: strings.TrimSpace(title), Lessons: []Lesson{}})
	return id
}

// RemoveModule удаляет модуль (с уроками и материалами). false — не найден.
func (c *Course) RemoveModule(id int64) bool {
	for i := range c.Content.Modules {
		if c.Content.Modules[i].ID == id {
			c.Content.Modules = append(c.Content.Modules[:i], c.Content.Modules[i+1:]...)
			c.recount()
			return true
		}
	}
	return false
}

// AddLesson добавляет урок в модуль; возвращает id урока и признак наличия модуля.
func (c *Course) AddLesson(moduleID int64, title string) (int64, bool) {
	m := c.findModule(moduleID)
	if m == nil {
		return 0, false
	}
	id := c.nextID()
	m.Lessons = append(m.Lessons, Lesson{ID: id, Title: strings.TrimSpace(title), Materials: []Material{}})
	c.recount()
	return id, true
}

// RemoveLesson удаляет урок. false — не найден.
func (c *Course) RemoveLesson(id int64) bool {
	for mi := range c.Content.Modules {
		m := &c.Content.Modules[mi]
		for li := range m.Lessons {
			if m.Lessons[li].ID == id {
				m.Lessons = append(m.Lessons[:li], m.Lessons[li+1:]...)
				c.recount()
				return true
			}
		}
	}
	return false
}

// AddMaterial добавляет материал в урок; size уже подготовлен вызывающим. false — урок не найден.
func (c *Course) AddMaterial(lessonID int64, matType, name, size string) (int64, bool) {
	l, _ := c.findLesson(lessonID)
	if l == nil {
		return 0, false
	}
	id := c.nextID()
	l.Materials = append(l.Materials, Material{ID: id, Type: matType, Name: strings.TrimSpace(name), Size: size})
	c.recount()
	return id, true
}

// RemoveMaterial удаляет материал. false — не найден.
func (c *Course) RemoveMaterial(id int64) bool {
	for mi := range c.Content.Modules {
		m := &c.Content.Modules[mi]
		for li := range m.Lessons {
			l := &m.Lessons[li]
			for i := range l.Materials {
				if l.Materials[i].ID == id {
					l.Materials = append(l.Materials[:i], l.Materials[i+1:]...)
					c.recount()
					return true
				}
			}
		}
	}
	return false
}
