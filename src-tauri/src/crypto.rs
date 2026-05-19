use hmac::Hmac;
use pbkdf2::pbkdf2;
use sha2::Sha512;

pub const KEY_LEN: usize = 32;
pub const ITERATIONS: u32 = 500_000;

pub fn derive_key(password: &str, salt: &[u8]) -> [u8; KEY_LEN] {
    let mut key = [0u8; KEY_LEN];
    pbkdf2::<Hmac<Sha512>>(password.as_bytes(), salt, ITERATIONS, &mut key)
        .expect("HMAC<Sha512> key length is always valid");
    key
}

pub fn key_to_hex(key: &[u8]) -> String {
    key.iter().map(|b| format!("{b:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pbkdf2_with_iters(password: &str, salt: &[u8], iterations: u32) -> [u8; KEY_LEN] {
        let mut key = [0u8; KEY_LEN];
        pbkdf2::<Hmac<Sha512>>(password.as_bytes(), salt, iterations, &mut key)
            .expect("HMAC<Sha512> key length is always valid");
        key
    }

    #[test]
    fn known_vector_c1() {
        // PBKDF2-HMAC-SHA512, P="password", S="salt", c=1, dkLen=32 (first 32 bytes of 64-byte output)
        let key = pbkdf2_with_iters("password", b"salt", 1);
        assert_eq!(
            key_to_hex(&key),
            "867f70cf1ade02cff3752599a3a53dc4af34c7a669815ae5d513554e1c8cf252"
        );
    }

    #[test]
    fn deterministic() {
        let k1 = derive_key("hunter2", b"testsalt");
        let k2 = derive_key("hunter2", b"testsalt");
        assert_eq!(k1, k2);
    }

    #[test]
    fn different_passwords_differ() {
        assert_ne!(derive_key("aaa", b"salt"), derive_key("bbb", b"salt"));
    }

    #[test]
    fn different_salts_differ() {
        assert_ne!(derive_key("pw", b"salt1"), derive_key("pw", b"salt2"));
    }

    #[test]
    fn hex_is_64_chars() {
        assert_eq!(key_to_hex(&derive_key("test", b"salt")).len(), 64);
    }
}
