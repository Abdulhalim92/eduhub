package identity

// OtpRequestInput — тело POST /auth/otp/request.
type OtpRequestInput struct {
	Phone string `json:"phone"`
}

// OtpVerifyInput — тело POST /auth/otp/verify.
type OtpVerifyInput struct {
	Phone string `json:"phone"`
	Code  string `json:"code"`
}

// SelectMembershipInput — тело POST /auth/membership.
type SelectMembershipInput struct {
	TenantID int64  `json:"tenantId"`
	Role     string `json:"role"`
}

// MembershipDTO — членство для /me и выбора.
type MembershipDTO struct {
	TenantID   int64  `json:"tenantId"`
	TenantName string `json:"tenantName"`
	Role       string `json:"role"`
	BranchID   *int64 `json:"branchId,omitempty"`
}

// MobileSession — рабочая сессия мобильного контура после выбора членства.
type MobileSession struct {
	AccountID    int64  `json:"accountId"`
	Phone        string `json:"phone"`
	Name         string `json:"name"`
	TenantID     int64  `json:"tenantId"`
	TenantName   string `json:"tenantName"`
	Role         string `json:"role"`
	StudentID    *int64 `json:"studentId,omitempty"`
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
}

// VerifyResult — результат проверки кода: либо сразу сессия (одно членство),
// либо токен выбора и список членств (несколько или ни одного).
type VerifyResult struct {
	Session     *MobileSession  `json:"session,omitempty"`
	SelectToken string          `json:"selectToken,omitempty"`
	Memberships []MembershipDTO `json:"memberships,omitempty"`
}

// MeResponse — профиль аккаунта и его членства (GET /me).
type MeResponse struct {
	AccountID   int64           `json:"accountId"`
	Phone       string          `json:"phone"`
	Name        string          `json:"name"`
	Locale      string          `json:"locale"`
	Current     *MembershipDTO  `json:"current,omitempty"`
	StudentID   *int64          `json:"studentId,omitempty"`
	Memberships []MembershipDTO `json:"memberships"`
}
