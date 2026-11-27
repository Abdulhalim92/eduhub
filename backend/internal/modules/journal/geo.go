package journal

import (
	"math"
	"strconv"
	"strings"
)

// shiftRadiusMeters — радиус гео-чек-ина смены от координат филиала (LRN-TCH-010).
const shiftRadiusMeters = 100.0

// distanceMeters — расстояние между точками (haversine).
func distanceMeters(aLat, aLng, bLat, bLng float64) float64 {
	const earthR = 6371000.0
	toRad := func(d float64) float64 { return d * math.Pi / 180 }
	dLat := toRad(bLat - aLat)
	dLng := toRad(bLng - aLng)
	h := math.Sin(dLat/2)*math.Sin(dLat/2) + math.Cos(toRad(aLat))*math.Cos(toRad(bLat))*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * earthR * math.Asin(math.Sqrt(h))
}

// parseDays разбирает CSV дней недели («0,2,4») в срез индексов.
func parseDays(csv string) []int {
	csv = strings.TrimSpace(csv)
	if csv == "" {
		return nil
	}
	parts := strings.Split(csv, ",")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			out = append(out, n)
		}
	}
	return out
}

func containsInt(xs []int, v int) bool {
	for _, x := range xs {
		if x == v {
			return true
		}
	}
	return false
}

// weekdayIndex — индекс дня недели 0..6 (Пн..Вс) для даты.
func weekdayIndex(wd int) int {
	// time.Weekday: Sunday=0..Saturday=6 → Пн=0..Вс=6.
	return (wd + 6) % 7
}
