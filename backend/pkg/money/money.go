// Package money хранит и считает деньги в дирамах (1 сомони = 100 дирам) как int64.
// Никогда float; одна валюта — сомони. См. .claude/rules/money.md.
package money

import (
	"fmt"
	"strconv"
)

// DiramPerSomoni — число дирам в одном сомони.
const DiramPerSomoni = 100

// Diram — денежная сумма в дирамах. Источник истины для хранения (БД BIGINT).
type Diram int64

// FromSomoni переводит целые сомони (как в контракте api.js) в дирамы.
func FromSomoni(somoni int64) Diram {
	return Diram(somoni * DiramPerSomoni)
}

// Somoni возвращает сумму в целых сомони, отбрасывая дробную часть дирам.
// В проекте все цены — целые сомони, поэтому потери точности нет.
func (d Diram) Somoni() int64 {
	return int64(d) / DiramPerSomoni
}

// IsWholeSomoni сообщает, что сумма кратна сомони (нет «копеек»).
func (d Diram) IsWholeSomoni() bool {
	return int64(d)%DiramPerSomoni == 0
}

func (d Diram) String() string {
	return strconv.FormatInt(int64(d), 10)
}

// MarshalJSON сериализует дирамы в целые сомони — так их ждёт фронтовый контракт.
func (d Diram) MarshalJSON() ([]byte, error) {
	return []byte(strconv.FormatInt(d.Somoni(), 10)), nil
}

// UnmarshalJSON читает целые сомони из JSON и хранит дирамы.
func (d *Diram) UnmarshalJSON(b []byte) error {
	s, err := strconv.ParseInt(string(b), 10, 64)
	if err != nil {
		return fmt.Errorf("money: ожидалось целое число сомони: %w", err)
	}
	*d = FromSomoni(s)
	return nil
}
