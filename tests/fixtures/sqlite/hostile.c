// Deliberately violate affine ownership to exercise the host registry defenses.
static Term sqlite_test_duplicate(Env e, Term* f, IoWork* w) {
  return io_tup(e, f[0], f[0]);
}
static void __attribute__((constructor)) sqlite_test_register(void) {
  io_eff(CID(duplicate), sqlite_test_duplicate, 0);
}
