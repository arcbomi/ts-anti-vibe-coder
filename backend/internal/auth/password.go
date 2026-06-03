package auth

import "golang.org/x/crypto/bcrypt"

const minPasswordLength = 8

// HashPassword hashes a plain-text password with bcrypt before persistence.
func HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// VerifyPassword checks whether a plain-text password matches a stored bcrypt hash.
func VerifyPassword(password, passwordHash string) bool {
	return bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)) == nil
}
