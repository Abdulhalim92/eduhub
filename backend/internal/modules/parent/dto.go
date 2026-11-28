package parent

// ChildGroup — группа ребёнка (краткая).
type ChildGroup struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Course string `json:"course"`
}

// ChildDTO — ребёнок в кабинете родителя.
type ChildDTO struct {
	StudentID  int64       `json:"studentId"`
	Name       string      `json:"name"`
	Status     string      `json:"status"`
	CenterID   int64       `json:"centerId"`
	CenterName string      `json:"centerName"`
	Group      *ChildGroup `json:"group,omitempty"`
}
