package auth

import (
	"testing"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
)

func TestValidateNewPassword(t *testing.T) {
	if err := validateNewPassword("short1", "old"); err == nil {
		t.Fatal("пароль короче 8 символов должен отклоняться")
	}
	if err := validateNewPassword("letters-only", "old"); err == nil {
		t.Fatal("пароль без цифры должен отклоняться")
	}
	if err := validateNewPassword("12345678", "old"); err == nil {
		t.Fatal("пароль без буквы должен отклоняться")
	}
	if err := validateNewPassword("paS1sword", "paS1sword"); err == nil {
		t.Fatal("новый пароль не должен совпадать с текущим")
	}
	if err := validateNewPassword("newPass123", "oldPass123"); err != nil {
		t.Fatalf("корректный пароль не должен отклоняться: %v", err)
	}
	// Кириллица тоже считается буквой (контракт допускает А-Яа-я).
	if err := validateNewPassword("пароль12", "старый"); err != nil {
		t.Fatalf("кириллический пароль с цифрой допустим: %v", err)
	}
}

func TestNormalizeLogin(t *testing.T) {
	if normalizeLogin("  ADMIN ") != "admin" {
		t.Fatal("логин должен обрезаться и приводиться к нижнему регистру")
	}
}

func TestTokenRoundTrip(t *testing.T) {
	ts := NewTokenService("secret", time.Minute, time.Hour)
	tid := int64(42)
	access, refresh, err := ts.Issue(User{ID: 1, Login: "admin", Role: RoleSuperAdmin, Name: "Алексей К.", TenantID: &tid})
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ts.Verify(access)
	if err != nil {
		t.Fatalf("валидный токен должен проходить проверку: %v", err)
	}
	if claims.Login != "admin" || claims.Role != RoleSuperAdmin || claims.UID != 1 {
		t.Fatalf("claims не совпадают: %+v", claims)
	}
	if claims.TenantID == nil || *claims.TenantID != 42 {
		t.Fatal("tenant_id должен сохраняться в токене")
	}
	if _, err := ts.Verify(refresh); err != nil {
		t.Fatalf("refresh-токен подписан тем же секретом: %v", err)
	}
}

func TestVerifyRejectsTampered(t *testing.T) {
	ts := NewTokenService("secret", time.Minute, time.Hour)
	other := NewTokenService("другой-секрет", time.Minute, time.Hour)
	access, _, _ := ts.Issue(User{ID: 1, Login: "admin", Role: RoleSuperAdmin})
	_, err := other.Verify(access)
	if err == nil {
		t.Fatal("токен, подписанный другим секретом, должен отклоняться")
	}
	var ae *apierr.Error
	if !asAPIErr(err, &ae) || ae.Code != apierr.CodeUnauthorized {
		t.Fatalf("ожидался UNAUTHORIZED, got %v", err)
	}
}

func asAPIErr(err error, target **apierr.Error) bool {
	if ae, ok := err.(*apierr.Error); ok {
		*target = ae
		return true
	}
	return false
}
