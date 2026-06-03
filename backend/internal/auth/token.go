package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrTokenExpired = errors.New("token expired")
	ErrTokenInvalid = errors.New("token invalid")
)

// TokenManager creates and validates compact HS256 JWT access tokens.
type TokenManager struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

type tokenHeader struct {
	Algorithm string `json:"alg"`
	Type      string `json:"typ"`
}

type AccessClaims struct {
	Subject string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Issued  int64  `json:"iat"`
	Expires int64  `json:"exp"`
}

func NewTokenManager(secret string, ttl time.Duration) (*TokenManager, error) {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return nil, fmt.Errorf("jwt secret is required")
	}
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &TokenManager{secret: []byte(secret), ttl: ttl, now: time.Now}, nil
}

func (m *TokenManager) Generate(user User) (string, error) {
	now := m.now().UTC()
	claims := AccessClaims{
		Subject: user.ID,
		Email:   user.Email,
		Name:    user.Name,
		Issued:  now.Unix(),
		Expires: now.Add(m.ttl).Unix(),
	}
	return m.sign(claims)
}

func (m *TokenManager) Validate(token string) (AccessClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return AccessClaims{}, ErrTokenInvalid
	}

	signed := parts[0] + "." + parts[1]
	expected := signHS256([]byte(signed), m.secret)
	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(actual, expected) {
		return AccessClaims{}, ErrTokenInvalid
	}

	var header tokenHeader
	if err := decodeSegment(parts[0], &header); err != nil {
		return AccessClaims{}, ErrTokenInvalid
	}
	if header.Algorithm != "HS256" || header.Type != "JWT" {
		return AccessClaims{}, ErrTokenInvalid
	}

	var claims AccessClaims
	if err := decodeSegment(parts[1], &claims); err != nil {
		return AccessClaims{}, ErrTokenInvalid
	}
	if strings.TrimSpace(claims.Subject) == "" || claims.Expires == 0 {
		return AccessClaims{}, ErrTokenInvalid
	}
	if m.now().UTC().Unix() >= claims.Expires {
		return AccessClaims{}, ErrTokenExpired
	}
	return claims, nil
}

func (m *TokenManager) sign(claims AccessClaims) (string, error) {
	headerSegment, err := encodeSegment(tokenHeader{Algorithm: "HS256", Type: "JWT"})
	if err != nil {
		return "", err
	}
	claimsSegment, err := encodeSegment(claims)
	if err != nil {
		return "", err
	}
	signed := headerSegment + "." + claimsSegment
	sig := signHS256([]byte(signed), m.secret)
	return signed + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func signHS256(payload []byte, secret []byte) []byte {
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(payload)
	return mac.Sum(nil)
}

func encodeSegment(value any) (string, error) {
	data, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(data), nil
}

func decodeSegment(segment string, dest any) error {
	data, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, dest)
}
