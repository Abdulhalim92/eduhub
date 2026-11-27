package identity

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// otpTTL и otpLock — срок жизни кода и блокировка после серии неверных попыток (SYS-ACC-030, BR-025).
const (
	otpLen          = 6
	otpMaxAttempts  = 5
	otpResendWindow = 60 // секунд между запросами кода на один номер
)

// genCode генерирует N-значный цифровой код.
func genCode() (string, error) {
	var b strings.Builder
	for i := 0; i < otpLen; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", fmt.Errorf("identity: rand: %w", err)
		}
		b.WriteByte(byte('0' + n.Int64()))
	}
	return b.String(), nil
}

// hashCode хэширует код (в открытом виде не хранится).
func hashCode(code string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(code), bcrypt.MinCost)
	if err != nil {
		return "", fmt.Errorf("identity: hash code: %w", err)
	}
	return string(h), nil
}

// checkCode сверяет код с хэшем.
func checkCode(hash, code string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(code)) == nil
}

// digitsOnly оставляет только цифры (для сопоставления телефонов учеников).
func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

// normalizePhone приводит номер к E.164 (регион по умолчанию +992, Таджикистан).
func normalizePhone(raw string) string {
	d := digitsOnly(raw)
	switch {
	case d == "":
		return ""
	case len(d) == 9: // локальный номер без кода страны
		return "+992" + d
	case strings.HasPrefix(d, "0") && len(d) == 10: // 0XXXXXXXXX
		return "+992" + d[1:]
	default:
		return "+" + d
	}
}
