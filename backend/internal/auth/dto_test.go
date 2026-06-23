package auth

import "testing"

func TestLoginRequestUnmarshalJSONAcceptsCredentialAliases(t *testing.T) {
	tests := []struct {
		name           string
		body           string
		wantCredential string
		wantEmail      string
	}{
		{
			name:           "credential field",
			body:           `{"credential":"student-user","password":"correct-password"}`,
			wantCredential: "student-user",
		},
		{
			name:           "email field",
			body:           `{"email":"student@example.com","password":"correct-password"}`,
			wantCredential: "student@example.com",
			wantEmail:      "student@example.com",
		},
		{
			name:           "username field",
			body:           `{"username":"student-user","password":"correct-password"}`,
			wantCredential: "student-user",
		},
		{
			name:           "name field",
			body:           `{"name":"student-user","password":"correct-password"}`,
			wantCredential: "student-user",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var req LoginRequest
			if err := req.UnmarshalJSON([]byte(tc.body)); err != nil {
				t.Fatalf("UnmarshalJSON returned error: %v", err)
			}
			if req.Credential != tc.wantCredential {
				t.Fatalf("Credential = %q, want %q", req.Credential, tc.wantCredential)
			}
			if req.Email != tc.wantEmail {
				t.Fatalf("Email = %q, want %q", req.Email, tc.wantEmail)
			}
			if req.Password != "correct-password" {
				t.Fatalf("Password = %q, want correct-password", req.Password)
			}
		})
	}
}
