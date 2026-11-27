package marketplace

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// courseDirections — направления курсов (как COURSE_DIRECTIONS в api.js).
var courseDirections = []string{"Языки", "Подготовка к НЦТ", "IT и программирование", "Математика", "Творчество"}

var idCover = map[int64]string{1: "english", 2: "nct-math", 3: "python", 4: "tajik", 5: "mental", 6: "scratch"}
var directionCover = map[string]string{"Языки": "english", "Подготовка к НЦТ": "nct-math", "IT и программирование": "python", "Математика": "mental", "Творчество": "creative"}

func cover(c Course) string {
	key := "english"
	if v, ok := idCover[c.ID]; ok {
		key = v
	} else if v, ok := directionCover[c.Direction]; ok {
		key = v
	}
	return "src/assets/courses/" + key + ".jpg"
}

// publishBlockers перечисляет, чего не хватает для публикации (BR-013).
func publishBlockers(c Course) []string {
	b := []string{}
	if c.PriceDiram <= 0 {
		b = append(b, "укажите цену")
	}
	if c.Lessons < 1 {
		b = append(b, "добавьте хотя бы один урок")
	}
	return b
}

// CourseDTO — курс для ответа (courseDto). Деньги — целые сомони.
type CourseDTO struct {
	ID              int64       `json:"id"`
	Title           string      `json:"title"`
	Direction       string      `json:"direction"`
	Description     string      `json:"description"`
	Note            string      `json:"note"`
	Status          string      `json:"status"`
	Price           money.Diram `json:"price"`
	OwnerCenterID   *int64      `json:"ownerCenterId"`
	Lessons         int         `json:"lessons"`
	Tests           int         `json:"tests"`
	Buyers          int         `json:"buyers"`
	Cover           string      `json:"cover"`
	PublishBlockers []string    `json:"publishBlockers"`
}

func toCourseDTO(c Course, activeBuyers int) CourseDTO {
	return CourseDTO{
		ID: c.ID, Title: c.Title, Direction: c.Direction, Description: c.Description, Note: c.Note,
		Status: c.Status, Price: c.PriceDiram, OwnerCenterID: c.OwnerCenterID,
		Lessons: c.Lessons, Tests: c.Tests, Buyers: activeBuyers + c.BuyersOther,
		Cover: cover(c), PublishBlockers: publishBlockers(c),
	}
}

// ListMeta — сводка каталога методик.
type ListMeta struct {
	Published int   `json:"published"`
	Draft     int   `json:"draft"`
	Buyers    int   `json:"buyers"`
	Revenue   int64 `json:"revenue"` // сомони: сумма buyers*price
	Requests  int   `json:"requests"`
}

// ListResponse — ответ marketplace.list.
type ListResponse struct {
	Items      []CourseDTO `json:"items"`
	Total      int         `json:"total"`
	Directions []string    `json:"directions"`
	Meta       ListMeta    `json:"meta"`
}

// AccessDTO — доступ центра к курсу (для покупателей и «моих методик»).
type AccessDTO struct {
	ID           int64      `json:"id"`
	CenterID     int64      `json:"centerId"`
	CenterName   string     `json:"centerName"`
	City         string     `json:"city"`
	Source       string     `json:"source"`
	InvoiceID    *string    `json:"invoiceId"`
	Reason       string     `json:"reason"`
	GrantedAt    time.Time  `json:"grantedAt"`
	Status       string     `json:"status"`
	RevokedAt    *time.Time `json:"revokedAt"`
	RevokeReason string     `json:"revokeReason"`
	Version      Version    `json:"version"`
	Course       *CourseDTO `json:"course"`
}

// Version — зафиксированная при передаче версия курса (BR-015).
type Version struct {
	Lessons int `json:"lessons"`
	Tests   int `json:"tests"`
}

// RequestDTO — заявка центра на курс.
type RequestDTO struct {
	ID         int64      `json:"id"`
	CenterID   int64      `json:"centerId"`
	CenterName string     `json:"centerName"`
	City       string     `json:"city"`
	CourseID   int64      `json:"courseId"`
	Status     string     `json:"status"`
	Note       string     `json:"note"`
	CreatedAt  time.Time  `json:"createdAt"`
	InvoiceID  *string    `json:"invoiceId"`
	Reason     string     `json:"reason"`
	DecidedAt  *time.Time `json:"decidedAt"`
	Course     *CourseDTO `json:"course"`
}

// CatalogItem — курс каталога для центра со статусом владения.
type CatalogItem struct {
	CourseDTO
	State     string `json:"state"` // available | requested | invoiced | owned
	RequestID *int64 `json:"requestId"`
}

// CoursePage — страница курса (courses.get).
type CoursePage struct {
	Course  CourseDTO  `json:"course"`
	Content Program    `json:"content"`
	CanEdit bool       `json:"canEdit"`
	Kind    string     `json:"kind"` // platform | own | purchased
	Access  *AccessDTO `json:"access"`
}
