package auth

// Session — ответ на вход (sessionDto из контракта) плюс выпущенные токены.
type Session struct {
	Login        string  `json:"login"`
	Role         string  `json:"role"`
	RoleLabel    string  `json:"roleLabel"`
	Name         string  `json:"name"`
	CenterID     *int64  `json:"centerId"`
	CenterName   *string `json:"centerName"`
	MustChange   bool    `json:"mustChange"`
	Cabinet      bool    `json:"cabinet"`
	Token        string  `json:"token"`
	RefreshToken string  `json:"refreshToken"`
}

// LoginRequest — тело POST /auth/login.
type LoginRequest struct {
	Login    string `json:"login"`
	Password string `json:"password"`
}

// ChangePasswordRequest — тело POST /auth/password.
type ChangePasswordRequest struct {
	Login       string `json:"login"`
	Password    string `json:"password"`
	NewPassword string `json:"newPassword"`
}
