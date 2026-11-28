package moderation

import "math"

// cities и directions — справочники (как CITIES/DIRECTIONS в api.js).
var cities = []string{"Душанбе", "Худжанд", "Бохтар", "Куляб", "Турсунзода", "Исфара", "Хорог"}
var directions = []string{"Математика", "Английский язык", "Программирование", "Робототехника", "Подготовка к НЦТ", "Творчество", "Шахматы", "Музыка"}

// cityCoords — центры городов для мок-геокодера.
var cityCoords = map[string][2]float64{
	"Душанбе":    {38.5598, 68.7870},
	"Худжанд":    {40.2826, 69.6220},
	"Бохтар":     {37.8365, 68.7802},
	"Куляб":      {37.9114, 69.7840},
	"Турсунзода": {38.5133, 68.2308},
	"Исфара":     {40.1269, 70.6283},
	"Хорог":      {37.4896, 71.5535},
}

// Point — географическая точка.
type Point struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

// Geocode детерминированно превращает «город + адрес» в координаты рядом с центром города (мок, INT-GEO-010).
func Geocode(city, address string) Point {
	base, ok := cityCoords[city]
	if !ok {
		base = cityCoords["Душанбе"]
	}
	var h uint32
	for _, ch := range address {
		h = h*31 + uint32(ch)
	}
	r4 := func(v float64) float64 { return math.Round(v*1e4) / 1e4 }
	lat := r4(base[0] + float64(int(h%200)-100)/10000)
	lng := r4(base[1] + float64(int((h>>8)%200)-100)/10000)
	return Point{Lat: lat, Lng: lng}
}

// distanceMeters — расстояние между точками (haversine), для метки «GPS расходится» (BR-017).
func distanceMeters(a, b Point) float64 {
	const earthR = 6371000.0
	toRad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := toRad(b.Lat - a.Lat)
	dLng := toRad(b.Lng - a.Lng)
	la := toRad(a.Lat)
	lb := toRad(b.Lat)
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(la)*math.Cos(lb)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthR * math.Asin(math.Sqrt(h))
}

func inTajikistan(lat, lng float64) bool {
	return lat >= 36.6 && lat <= 41.1 && lng >= 67.3 && lng <= 75.2
}

func directionsFor(centerID int64) []string {
	n := int64(len(directions))
	return []string{directions[centerID%n], directions[(centerID+3)%n]}
}
