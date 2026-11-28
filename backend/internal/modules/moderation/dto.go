package moderation

import "time"

// SubmissionDTO — заявка для ответа (modDto). gpsMismatch/noTj/publishBlockers считаются на сервере.
type SubmissionDTO struct {
	ID              int64      `json:"id"`
	CenterID        int64      `json:"centerId"`
	CenterName      string     `json:"centerName"`
	Branch          string     `json:"branch"`
	City            string     `json:"city"`
	District        string     `json:"district"`
	Address         string     `json:"address"`
	Phone           string     `json:"phone"`
	GPS             Point      `json:"gps"`
	Geo             Point      `json:"geo"`
	Desc            Desc       `json:"desc"`
	Status          string     `json:"status"`
	Reason          string     `json:"reason"`
	GPSOk           bool       `json:"gpsOk"`
	SubmittedBy     string     `json:"submittedBy"`
	SubmittedAt     time.Time  `json:"submittedAt"`
	DecidedAt       *time.Time `json:"decidedAt"`
	Directions      []string   `json:"directions"`
	GPSMismatch     bool       `json:"gpsMismatch"`
	GPSMismatchM    int        `json:"gpsMismatchMeters"`
	NoTJ            bool       `json:"noTj"`
	PublishBlockers []string   `json:"publishBlockers"`
}

// Desc — описания филиала на трёх языках.
type Desc struct {
	RU string `json:"ru"`
	TJ string `json:"tj"`
	EN string `json:"en"`
}

// descLenOK — минимальная длина описания для публикации (BR-017).
const descMinLen = 20

func publishBlockers(s Submission) []string {
	b := []string{}
	if lenRunes(s.DescRU) < descMinLen {
		b = append(b, "описание RU обязательно (от 20 символов)")
	}
	if lenRunes(s.DescTJ) < descMinLen {
		b = append(b, "описание TJ обязательно (от 20 символов)")
	}
	if !s.GPSOk {
		b = append(b, "подтвердите координаты на карте")
	}
	return b
}

func lenRunes(s string) int { return len([]rune(s)) }

func toDTO(s Submission, centerName string) SubmissionDTO {
	gps := Point{Lat: s.GPSLat, Lng: s.GPSLng}
	geo := Point{Lat: s.GeoLat, Lng: s.GeoLng}
	dist := distanceMeters(gps, geo)
	return SubmissionDTO{
		ID: s.ID, CenterID: s.CenterID, CenterName: centerName, Branch: s.Branch, City: s.City,
		District: s.District, Address: s.Address, Phone: s.Phone, GPS: gps, Geo: geo,
		Desc:   Desc{RU: s.DescRU, TJ: s.DescTJ, EN: s.DescEN},
		Status: s.Status, Reason: s.Reason, GPSOk: s.GPSOk, SubmittedBy: s.SubmittedBy,
		SubmittedAt: s.SubmittedAt, DecidedAt: s.DecidedAt, Directions: directionsFor(s.CenterID),
		GPSMismatch: dist > 150, GPSMismatchM: int(dist + 0.5), NoTJ: lenRunes(s.DescTJ) < descMinLen,
		PublishBlockers: publishBlockers(s),
	}
}

// ListMeta — сводка очереди модерации.
type ListMeta struct {
	Pending   int `json:"pending"`
	Processed int `json:"processed"`
}

// ListResponse — ответ moderation.list.
type ListResponse struct {
	Items []SubmissionDTO `json:"items"`
	Meta  ListMeta        `json:"meta"`
}

// BranchesMeta — лимит филиалов тарифа в кабинете центра.
type BranchesMeta struct {
	Limit int    `json:"limit"`
	Used  int    `json:"used"`
	Plan  string `json:"plan"`
}

// BranchesResponse — ответ cabinet.branches.list.
type BranchesResponse struct {
	Items  []SubmissionDTO `json:"items"`
	Meta   BranchesMeta    `json:"meta"`
	Cities []string        `json:"cities"`
}

// BranchInput — тело подачи/правки заявки филиала.
type BranchInput struct {
	Branch   string `json:"branch"`
	City     string `json:"city"`
	District string `json:"district"`
	Address  string `json:"address"`
	Phone    string `json:"phone"`
	GPS      Point  `json:"gps"`
	Desc     Desc   `json:"desc"`
}

// DecideInput — тело решения модерации.
type DecideInput struct {
	Decision     string `json:"decision"`
	Reason       string `json:"reason"`
	Desc         *Desc  `json:"desc"`
	GPS          *Point `json:"gps"`
	GPSConfirmed bool   `json:"gpsConfirmed"`
}
