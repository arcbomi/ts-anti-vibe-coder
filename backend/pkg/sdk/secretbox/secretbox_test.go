package secretbox

import "testing"

func TestCipherRoundTrip(t *testing.T) {
	cipher, err := New("test-secret")
	if err != nil {
		t.Fatalf("New returned error: %v", err)
	}
	encrypted, err := cipher.Encrypt("correct-password")
	if err != nil {
		t.Fatalf("Encrypt returned error: %v", err)
	}
	if encrypted == "correct-password" {
		t.Fatal("Encrypt should not return plaintext")
	}
	decrypted, err := cipher.Decrypt(encrypted)
	if err != nil {
		t.Fatalf("Decrypt returned error: %v", err)
	}
	if decrypted != "correct-password" {
		t.Fatalf("Decrypt = %q, want %q", decrypted, "correct-password")
	}
}
