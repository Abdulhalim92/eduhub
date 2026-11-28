package money

import (
	"encoding/json"
	"math"
	"testing"
)

func TestFromSomoniAndBack(t *testing.T) {
	cases := []int64{0, 1, 400, 900, 1800, 1_000_000}
	for _, s := range cases {
		d := FromSomoni(s)
		if int64(d) != s*DiramPerSomoni {
			t.Fatalf("FromSomoni(%d) = %d дирам, ожидалось %d", s, int64(d), s*DiramPerSomoni)
		}
		if got := d.Somoni(); got != s {
			t.Fatalf("Somoni() = %d, ожидалось %d", got, s)
		}
	}
}

func TestMarshalJSONReturnsSomoni(t *testing.T) {
	d := FromSomoni(900)
	b, err := json.Marshal(d)
	if err != nil {
		t.Fatal(err)
	}
	if string(b) != "900" {
		t.Fatalf("JSON = %s, ожидалось 900 (сомони)", b)
	}
}

func TestUnmarshalJSONReadsSomoni(t *testing.T) {
	var d Diram
	if err := json.Unmarshal([]byte("1800"), &d); err != nil {
		t.Fatal(err)
	}
	if int64(d) != 180000 {
		t.Fatalf("Unmarshal 1800 сомони = %d дирам, ожидалось 180000", int64(d))
	}
}

func TestIsWholeSomoni(t *testing.T) {
	if !FromSomoni(5).IsWholeSomoni() {
		t.Fatal("5 сомони должно быть кратно сомони")
	}
	if (Diram(150)).IsWholeSomoni() {
		t.Fatal("150 дирам (1.5 сомони) не кратно сомони")
	}
}

func TestLargeAmountNoOverflowWithinInt64(t *testing.T) {
	// Граница: максимум int64 в дирамах не переполняется при обратном переводе.
	d := Diram(math.MaxInt64)
	if d.Somoni() != math.MaxInt64/DiramPerSomoni {
		t.Fatal("перевод максимума int64 в сомони некорректен")
	}
}
