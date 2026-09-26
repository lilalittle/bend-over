// SQLite C effects. Only the loop marshals Bend terms; workers own host buffers.
#include <sqlite3.h>
#include <dlfcn.h>
#include <limits.h>

#ifndef CID(I64)
#define CID(I64) 0
#endif
#ifndef CID(F64)
#define CID(F64) 0
#endif
#ifndef CID(Null)
#define CID(Null) 0
#endif
#ifndef CID(Integer)
#define CID(Integer) 0
#endif
#ifndef CID(Real)
#define CID(Real) 0
#endif
#ifndef CID(Text)
#define CID(Text) 0
#endif
#ifndef CID(Blob)
#define CID(Blob) 0
#endif
#ifndef CID(Row)
#define CID(Row) 0
#endif
#ifndef CID(Rows)
#define CID(Rows) 0
#endif
#ifndef CID(Stats)
#define CID(Stats) 0
#endif
#ifndef CID(Some)
#define CID(Some) 0
#endif
#ifndef CID(None)
#define CID(None) 0
#endif
#ifndef CID(Con)
#define CID(Con) 0
#endif
#ifndef CID(Nil)
#define CID(Nil) 0
#endif
static __typeof__(&sqlite3_libversion_number) bs_libversion_number;
static __typeof__(&sqlite3_open_v2) bs_open_v2;
static __typeof__(&sqlite3_close) bs_close;
static __typeof__(&sqlite3_extended_result_codes) bs_extended_result_codes;
static __typeof__(&sqlite3_extended_errcode) bs_extended_errcode;
static __typeof__(&sqlite3_errmsg) bs_errmsg;
static __typeof__(&sqlite3_errstr) bs_errstr;
static __typeof__(&sqlite3_prepare_v2) bs_prepare_v2;
static __typeof__(&sqlite3_finalize) bs_finalize;
static __typeof__(&sqlite3_step) bs_step;
static __typeof__(&sqlite3_reset) bs_reset;
static __typeof__(&sqlite3_clear_bindings) bs_clear_bindings;
static __typeof__(&sqlite3_bind_parameter_count) bs_bind_parameter_count;
static __typeof__(&sqlite3_bind_parameter_index) bs_bind_parameter_index;
static __typeof__(&sqlite3_bind_null) bs_bind_null;
static __typeof__(&sqlite3_bind_int64) bs_bind_int64;
static __typeof__(&sqlite3_bind_double) bs_bind_double;
static __typeof__(&sqlite3_bind_text) bs_bind_text;
static __typeof__(&sqlite3_bind_blob) bs_bind_blob;
static __typeof__(&sqlite3_column_count) bs_column_count;
static __typeof__(&sqlite3_column_name) bs_column_name;
static __typeof__(&sqlite3_column_type) bs_column_type;
static __typeof__(&sqlite3_column_int64) bs_column_int64;
static __typeof__(&sqlite3_column_double) bs_column_double;
static __typeof__(&sqlite3_column_text) bs_column_text;
static __typeof__(&sqlite3_column_blob) bs_column_blob;
static __typeof__(&sqlite3_column_bytes) bs_column_bytes;
static __typeof__(&sqlite3_exec) bs_exec;
static __typeof__(&sqlite3_changes64) bs_changes64;
static __typeof__(&sqlite3_last_insert_rowid) bs_last_insert_rowid;
static __typeof__(&sqlite3_busy_timeout) bs_busy_timeout;
static __typeof__(&sqlite3_malloc64) bs_malloc64;
static __typeof__(&sqlite3_free) bs_free;
static __typeof__(&sqlite3_serialize) bs_serialize;
static __typeof__(&sqlite3_deserialize) bs_deserialize;
static void* bs_library;
static int bs_load_state;
static bool bs_load(void) {
  if (bs_load_state) return bs_load_state > 0;
  bs_load_state = -1;
  const char* override = getenv("BEND_SQLITE_LIBRARY");
  const char* paths[] = {override, "libsqlite3.dylib", "/usr/lib/libsqlite3.dylib", "libsqlite3.so.0", "libsqlite3.so"};
  for (u32 i = 0; i < 5; ++i) {
    if (paths[i]) bs_library = dlopen(paths[i], RTLD_NOW | RTLD_LOCAL);
    if (bs_library || override) break;
  }
  if (!bs_library) return false;
  bs_libversion_number = dlsym(bs_library, "sqlite3_libversion_number");
  bs_open_v2 = dlsym(bs_library, "sqlite3_open_v2");
  bs_close = dlsym(bs_library, "sqlite3_close");
  bs_extended_result_codes = dlsym(bs_library, "sqlite3_extended_result_codes");
  bs_extended_errcode = dlsym(bs_library, "sqlite3_extended_errcode");
  bs_errmsg = dlsym(bs_library, "sqlite3_errmsg");
  bs_errstr = dlsym(bs_library, "sqlite3_errstr");
  bs_prepare_v2 = dlsym(bs_library, "sqlite3_prepare_v2");
  bs_finalize = dlsym(bs_library, "sqlite3_finalize");
  bs_step = dlsym(bs_library, "sqlite3_step");
  bs_reset = dlsym(bs_library, "sqlite3_reset");
  bs_clear_bindings = dlsym(bs_library, "sqlite3_clear_bindings");
  bs_bind_parameter_count = dlsym(bs_library, "sqlite3_bind_parameter_count");
  bs_bind_parameter_index = dlsym(bs_library, "sqlite3_bind_parameter_index");
  bs_bind_null = dlsym(bs_library, "sqlite3_bind_null");
  bs_bind_int64 = dlsym(bs_library, "sqlite3_bind_int64");
  bs_bind_double = dlsym(bs_library, "sqlite3_bind_double");
  bs_bind_text = dlsym(bs_library, "sqlite3_bind_text");
  bs_bind_blob = dlsym(bs_library, "sqlite3_bind_blob");
  bs_column_count = dlsym(bs_library, "sqlite3_column_count");
  bs_column_name = dlsym(bs_library, "sqlite3_column_name");
  bs_column_type = dlsym(bs_library, "sqlite3_column_type");
  bs_column_int64 = dlsym(bs_library, "sqlite3_column_int64");
  bs_column_double = dlsym(bs_library, "sqlite3_column_double");
  bs_column_text = dlsym(bs_library, "sqlite3_column_text");
  bs_column_blob = dlsym(bs_library, "sqlite3_column_blob");
  bs_column_bytes = dlsym(bs_library, "sqlite3_column_bytes");
  bs_exec = dlsym(bs_library, "sqlite3_exec");
  bs_changes64 = dlsym(bs_library, "sqlite3_changes64");
  bs_last_insert_rowid = dlsym(bs_library, "sqlite3_last_insert_rowid");
  bs_busy_timeout = dlsym(bs_library, "sqlite3_busy_timeout");
  bs_malloc64 = dlsym(bs_library, "sqlite3_malloc64");
  bs_free = dlsym(bs_library, "sqlite3_free");
  bs_serialize = dlsym(bs_library, "sqlite3_serialize");
  bs_deserialize = dlsym(bs_library, "sqlite3_deserialize");
  if (!bs_libversion_number || !bs_open_v2 || !bs_close || !bs_extended_result_codes || !bs_extended_errcode || !bs_errmsg || !bs_errstr || !bs_prepare_v2 || !bs_finalize || !bs_step || !bs_reset || !bs_clear_bindings || !bs_bind_parameter_count || !bs_bind_parameter_index || !bs_bind_null || !bs_bind_int64 || !bs_bind_double || !bs_bind_text || !bs_bind_blob || !bs_column_count || !bs_column_name || !bs_column_type || !bs_column_int64 || !bs_column_double || !bs_column_text || !bs_column_blob || !bs_column_bytes || !bs_exec || !bs_changes64 || !bs_last_insert_rowid || !bs_busy_timeout || !bs_malloc64 || !bs_free) return false;
  if (bs_libversion_number() < 3037000) return false;
  bs_load_state = 1; return true;
}

typedef struct BsObject BsObject;
struct BsObject {
  u64 id;
  int kind, state, refs, removed;
  sqlite3* db;
  sqlite3_stmt* stmt;
  BsObject* owner;
  BsObject* next;
  pthread_mutex_t lock;
  u32 statements;
};
static pthread_mutex_t bs_registry_lock = PTHREAD_MUTEX_INITIALIZER;
static BsObject* bs_registry;
static u64 bs_next_id = 0x100000000ull;

// Registry references keep queued jobs alive. IDs never alias file descriptors or
// recycled addresses. Statements keep their parent alive until finalization.
static BsObject* bs_lookup(u64 id) {
  pthread_mutex_lock(&bs_registry_lock);
  BsObject* o = bs_registry;
  while (o && o->id != id) o = o->next;
  if (o) o->refs++;
  pthread_mutex_unlock(&bs_registry_lock);
  return o;
}
static void bs_release(BsObject* o) {
  if (!o) return;
  pthread_mutex_lock(&bs_registry_lock);
  bool destroy = --o->refs == 0;
  pthread_mutex_unlock(&bs_registry_lock);
  if (destroy) {
    BsObject* parent = o->owner;
    pthread_mutex_destroy(&o->lock);
    free(o);
    bs_release(parent);
  }
}
static void bs_remove(BsObject* o) {
  pthread_mutex_lock(&bs_registry_lock);
  BsObject** at = &bs_registry;
  while (*at && *at != o) at = &(*at)->next;
  if (*at) { *at = o->next; o->removed = 1; }
  pthread_mutex_unlock(&bs_registry_lock);
  bs_release(o); // registry reference
}
static BsObject* bs_register(int kind, sqlite3* db, sqlite3_stmt* stmt, BsObject* owner) {
  BsObject* o = io_mem(calloc(1, sizeof(*o)));
  o->kind = kind; o->db = db; o->stmt = stmt; o->owner = owner; o->refs = 1;
  pthread_mutex_init(&o->lock, NULL);
  pthread_mutex_lock(&bs_registry_lock);
  if (owner) owner->refs++;
  o->id = bs_next_id++; o->next = bs_registry; bs_registry = o;
  pthread_mutex_unlock(&bs_registry_lock);
  return o;
}

typedef struct { int type; int64_t integer; double real; char* data; u64 size; } BsValue;
typedef struct { BsValue* cells; u32 count; } BsRow;
typedef struct {
  int op, code;
  u64 handle, created;
  char* sql;
  u64 sql_size;
  u32 index;
  BsValue* values;
  u64 count;
  char* message;
  BsRow* rows;
  u64 row_count, row_cap;
  char** names;
  u32 name_count;
  int64_t changes, last_id;
  unsigned char* bytes;
  u64 byte_count;
} BsJob;
enum { BS_OPEN, BS_IMPORT, BS_CLOSE, BS_FINALIZE, BS_PREPARE, BS_BIND,
  BS_BIND_NAMED, BS_STEP, BS_RESET, BS_CLEAR, BS_NAMES, BS_COUNT, BS_INDEX,
  BS_SCRIPT, BS_EXECUTE, BS_QUERY, BS_TIMEOUT, BS_EXPORT };
static void bs_error(BsJob* j, int code, const char* message) {
  if (j->code) return;
  j->code = code; j->message = io_mem(strdup(message ? message : "SQLite error"));
}
static void bs_check(BsJob* j, int rc, sqlite3* db) {
  if (!rc) return;
  int extended = db ? bs_extended_errcode(db) : rc;
  bs_error(j, (extended & 255) == (rc & 255) ? extended : rc, db ? bs_errmsg(db) : bs_errstr(rc));
}
static void bs_value_free(BsValue* v) { free(v->data); }
static void bs_job_free(BsJob* j) {
  free(j->sql); free(j->message); free(j->bytes);
  for (u64 i = 0; i < j->count; ++i) bs_value_free(&j->values[i]);
  free(j->values);
  for (u64 r = 0; r < j->row_count; ++r) {
    for (u32 c = 0; c < j->rows[r].count; ++c) bs_value_free(&j->rows[r].cells[c]);
    free(j->rows[r].cells);
  }
  free(j->rows);
  for (u32 i = 0; i < j->name_count; ++i) free(j->names[i]);
  free(j->names); free(j);
}
static void bs_take(Env e, Term v, u32 n, Term* fields) {
  spare_free(e, cls_fit(n), ctr_take(e, v, n, fields));
}
static unsigned char* bs_bytes_take(Env e, Term list, u64* size, bool* bad) {
  u64 cap = 64, n = 0;
  unsigned char* out = io_mem(malloc(cap));
  while (term_aux(list) == CID(Con)) {
    Term f[2]; bs_take(e, list, 2, f);
    if (n == cap) out = io_mem(realloc(out, cap *= 2));
    if (f[0] > 255) *bad = true;
    out[n++] = (unsigned char)f[0]; list = f[1];
  }
  *size = n; return out;
}
static BsValue bs_value_take(Env e, Term v, bool* bad) {
  BsValue out = {0}; Term f[2]; u64 tag = term_aux(v);
  if (tag == CID(Null)) { out.type = SQLITE_NULL; return out; }
  if (tag == CID(Integer) || tag == CID(Real)) {
    Term words[2]; bs_take(e, v, 2, words);
    uint64_t bits = (uint64_t)(u32)words[0] | ((uint64_t)(u32)words[1] << 32);
    out.type = tag == CID(Integer) ? SQLITE_INTEGER : SQLITE_FLOAT;
    if (out.type == SQLITE_INTEGER) memcpy(&out.integer, &bits, 8);
    else memcpy(&out.real, &bits, 8);
  } else if (tag == CID(Text)) {
    bs_take(e, v, 1, f);
    out.type = SQLITE_TEXT; out.data = io_cstr(e, f[0], &out.size);
  } else if (tag == CID(Blob)) {
    bs_take(e, v, 1, f);
    out.type = SQLITE_BLOB; out.data = (char*)bs_bytes_take(e, f[0], &out.size, bad);
  } else *bad = true;
  return out;
}
static void bs_values_take(Env e, BsJob* j, Term list, bool* bad) {
  u64 cap = 8;
  j->values = io_mem(calloc(cap, sizeof(BsValue)));
  while (term_aux(list) == CID(Con)) {
    Term f[2]; bs_take(e, list, 2, f);
    if (j->count == cap) j->values = io_mem(realloc(j->values, (cap *= 2) * sizeof(BsValue)));
    j->values[j->count++] = bs_value_take(e, f[0], bad); list = f[1];
  }
}
static sqlite3_stmt* bs_prepare_one(BsJob* j, sqlite3* db) {
  sqlite3_stmt* stmt = NULL;
  const char* tail = NULL;
  bs_check(j, bs_prepare_v2(db, j->sql, (int)j->sql_size + 1, &stmt, &tail), db);
  if (!j->code && !stmt) bs_error(j, SQLITE_MISUSE, "Expected one SQL statement.");
  while (!j->code && tail && *tail) {
    sqlite3_stmt* extra = NULL; const char* next = NULL;
    int rc = bs_prepare_v2(db, tail, -1, &extra, &next);
    if (extra) bs_finalize(extra);
    bs_check(j, rc, db);
    if (extra) bs_error(j, SQLITE_MISUSE, "Expected one SQL statement; use script for multiple statements.");
    if (next <= tail) break;
    tail = next;
  }
  if (j->code && stmt) { bs_finalize(stmt); stmt = NULL; }
  return stmt;
}
static void bs_bind_value(BsJob* j, sqlite3* db, sqlite3_stmt* stmt, u32 index, BsValue* v) {
  int rc = SQLITE_MISUSE;
  if (v->size > INT_MAX || index > INT_MAX) { bs_error(j, SQLITE_TOOBIG, "SQLite value or index exceeds INT_MAX."); return; }
  switch (v->type) {
    case SQLITE_NULL: rc = bs_bind_null(stmt, index); break;
    case SQLITE_INTEGER: rc = bs_bind_int64(stmt, index, v->integer); break;
    case SQLITE_FLOAT: rc = bs_bind_double(stmt, index, v->real); break;
    case SQLITE_TEXT: rc = bs_bind_text(stmt, index, v->data, (int)v->size, SQLITE_TRANSIENT); break;
    case SQLITE_BLOB: rc = bs_bind_blob(stmt, index, v->data, (int)v->size, SQLITE_TRANSIENT); break;
  }
  bs_check(j, rc, db);
}
static void bs_names_copy(BsJob* j, sqlite3_stmt* stmt) {
  j->name_count = bs_column_count(stmt);
  j->names = io_mem(calloc(j->name_count + 1, sizeof(char*)));
  for (u32 i = 0; i < j->name_count; ++i) j->names[i] = io_mem(strdup(bs_column_name(stmt, i)));
}
static void bs_row_copy(BsJob* j, sqlite3_stmt* stmt) {
  if (j->row_count == j->row_cap) {
    j->row_cap = j->row_cap ? j->row_cap * 2 : 8;
    j->rows = io_mem(realloc(j->rows, j->row_cap * sizeof(BsRow)));
  }
  BsRow* r = &j->rows[j->row_count++]; r->count = bs_column_count(stmt);
  r->cells = io_mem(calloc(r->count + 1, sizeof(BsValue)));
  for (u32 i = 0; i < r->count; ++i) {
    BsValue* v = &r->cells[i]; v->type = bs_column_type(stmt, i);
    if (v->type == SQLITE_INTEGER) v->integer = bs_column_int64(stmt, i);
    else if (v->type == SQLITE_FLOAT) v->real = bs_column_double(stmt, i);
    else if (v->type == SQLITE_TEXT || v->type == SQLITE_BLOB) {
      const void* p = v->type == SQLITE_TEXT ? (const void*)bs_column_text(stmt, i) : bs_column_blob(stmt, i);
      v->size = bs_column_bytes(stmt, i); v->data = io_mem(malloc(v->size + 1));
      if (v->size) memcpy(v->data, p, v->size);
      v->data[v->size] = 0;
    }
  }
}
static void bs_query_run(BsJob* j, sqlite3* db) {
  sqlite3_stmt* stmt = bs_prepare_one(j, db);
  if (!stmt) return;
  if (j->count != (u64)bs_bind_parameter_count(stmt)) bs_error(j, SQLITE_RANGE, "Parameter count does not match supplied values.");
  for (u64 i = 0; i < j->count && !j->code; ++i) bs_bind_value(j, db, stmt, i + 1, &j->values[i]);
  if (!j->code && j->op == BS_QUERY) bs_names_copy(j, stmt);
  while (!j->code) {
    int rc = bs_step(stmt);
    if (rc == SQLITE_DONE) break;
    if (rc != SQLITE_ROW) { bs_check(j, rc, db); break; }
    if (j->op == BS_QUERY) bs_row_copy(j, stmt);
  }
  j->changes = bs_changes64(db); j->last_id = bs_last_insert_rowid(db);
  bs_check(j, bs_finalize(stmt), db);
}
static void bs_open_job(BsJob* j) {
  sqlite3* db = NULL;
  const char* path = j->op == BS_IMPORT ? ":memory:" : j->sql;
  if (!*path) { bs_error(j, SQLITE_CANTOPEN, "An empty database path is not supported."); return; }
  int flags = (j->op == BS_OPEN && j->index ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE) | SQLITE_OPEN_FULLMUTEX;
  bs_check(j, bs_open_v2(path, &db, flags, NULL), db);
  if (!j->code) bs_extended_result_codes(db, 1);
  if (!j->code && j->op == BS_IMPORT) {
    if (!bs_deserialize) bs_error(j, SQLITE_MISUSE, "This SQLite build has no deserialize support.");
    else if (j->byte_count < 100 || memcmp(j->bytes, "SQLite format 3\0", 16)) bs_error(j, SQLITE_NOTADB, "Invalid SQLite database image.");
    else {
      unsigned char* data = bs_malloc64(j->byte_count);
      if (!data) bs_error(j, SQLITE_NOMEM, "SQLite allocation failed.");
      else {
        memcpy(data, j->bytes, j->byte_count);
        bs_check(j, bs_deserialize(db, "main", data, j->byte_count, j->byte_count, SQLITE_DESERIALIZE_FREEONCLOSE | SQLITE_DESERIALIZE_RESIZEABLE), db);
        // With FREEONCLOSE SQLite also frees data if deserialize fails.
        if (!j->code) bs_check(j, bs_exec(db, "PRAGMA schema_version", NULL, NULL, NULL), db);
      }
    }
  }
  if (j->code) { if (db) bs_close(db); return; }
  j->created = bs_register(0, db, NULL, NULL)->id;
}
static void bs_call(IoWork* w) {
  BsJob* j = (BsJob*)w->data;
  if (j->code) return;
  if (j->op == BS_OPEN || j->op == BS_IMPORT) { bs_open_job(j); return; }
  BsObject* o = bs_lookup(j->handle);
  int kind = j->op == BS_FINALIZE || (j->op >= BS_BIND && j->op <= BS_INDEX);
  if (!o) { bs_error(j, SQLITE_MISUSE, "Invalid or expired SQLite handle."); return; }
  BsObject* parent = o->owner ? o->owner : o;
  pthread_mutex_lock(&parent->lock);
  if (o->removed || o->kind != kind || !parent->db) bs_error(j, SQLITE_MISUSE, "Invalid or expired SQLite handle.");
  sqlite3* db = parent->db;
  if (!j->code) switch (j->op) {
    case BS_CLOSE:
      if (o->statements) bs_error(j, SQLITE_BUSY, "Cannot close a connection with outstanding statements.");
      else { int rc = bs_close(db); if (rc) bs_check(j, rc, db); else { o->db = NULL; bs_remove(o); } }
      break;
    case BS_PREPARE: {
      sqlite3_stmt* stmt = bs_prepare_one(j, db);
      if (stmt) { j->created = bs_register(1, NULL, stmt, o)->id; o->statements++; }
      break;
    }
    case BS_BIND: case BS_BIND_NAMED:
      if (o->state) { bs_error(j, SQLITE_MISUSE, "Reset the statement before binding."); break; }
      if (j->op == BS_BIND_NAMED) { j->index = bs_bind_parameter_index(o->stmt, j->sql); if (!j->index) bs_error(j, SQLITE_RANGE, "Unknown parameter name."); }
      if (!j->code) bs_bind_value(j, db, o->stmt, j->index, j->values);
      break;
    case BS_STEP: {
      if (o->state >= 2) { bs_error(j, SQLITE_MISUSE, "Reset the statement before stepping again."); break; }
      int rc = bs_step(o->stmt);
      o->state = rc == SQLITE_ROW ? 1 : rc == SQLITE_DONE ? 2 : 3;
      if (rc == SQLITE_ROW) bs_row_copy(j, o->stmt);
      else if (rc != SQLITE_DONE) bs_check(j, rc, db);
      break;
    }
    case BS_RESET: o->state = 0; bs_check(j, bs_reset(o->stmt), db); break;
    case BS_CLEAR: bs_check(j, bs_clear_bindings(o->stmt), db); break;
    case BS_NAMES: bs_names_copy(j, o->stmt); break;
    case BS_COUNT: j->index = bs_bind_parameter_count(o->stmt); break;
    case BS_INDEX: j->index = bs_bind_parameter_index(o->stmt, j->sql); break;
    case BS_FINALIZE:
      bs_check(j, bs_finalize(o->stmt), db); o->stmt = NULL; parent->statements--; bs_remove(o); break;
    case BS_SCRIPT: bs_check(j, bs_exec(db, j->sql, NULL, NULL, NULL), db); break;
    case BS_QUERY: case BS_EXECUTE: bs_query_run(j, db); break;
    case BS_TIMEOUT:
      if (j->index > INT_MAX) bs_error(j, SQLITE_MISUSE, "Busy timeout exceeds INT_MAX.");
      else bs_check(j, bs_busy_timeout(db, j->index), db);
      break;
    case BS_EXPORT: {
      if (!bs_serialize) { bs_error(j, SQLITE_MISUSE, "This SQLite build has no serialize support."); break; }
      sqlite3_int64 size = 0; unsigned char* data = bs_serialize(db, "main", &size, 0);
      if (!data) { bs_error(j, SQLITE_ERROR, "Cannot export an empty or unavailable database image."); break; }
      j->byte_count = size; j->bytes = io_mem(malloc(size ? size : 1));
      if (size) memcpy(j->bytes, data, size);
      bs_free(data); break;
    }
  }
  pthread_mutex_unlock(&parent->lock);
  bs_release(o);
}
static Term bs_words(Env e, u64 cid, uint64_t bits) { return io_node(e, cid, (u32)bits, (u32)(bits >> 32)); }
static Term bs_bytes_pack(Env e, const unsigned char* data, u64 n) {
  Term list = term_pak(CID(Nil), 0);
  while (n) list = io_node(e, CID(Con), data[--n], list);
  return list;
}
static Term bs_value_pack(Env e, BsValue* v) {
  uint64_t bits;
  switch (v->type) {
    case SQLITE_INTEGER: memcpy(&bits, &v->integer, 8); return bs_words(e, CID(Integer), bits);
    case SQLITE_FLOAT: memcpy(&bits, &v->real, 8); return bs_words(e, CID(Real), bits);
    case SQLITE_TEXT: return io_box(e, CID(Text), io_str(e, v->data, v->size));
    case SQLITE_BLOB: return io_box(e, CID(Blob), bs_bytes_pack(e, (unsigned char*)v->data, v->size));
    default: return term_pak(CID(Null), 0);
  }
}
static Term bs_row_pack(Env e, BsRow* row) {
  Term list = term_pak(CID(Nil), 0);
  for (u32 i = row->count; i; --i) list = io_node(e, CID(Con), bs_value_pack(e, &row->cells[i-1]), list);
  return io_box(e, CID(Row), list);
}
static Term bs_names_pack(Env e, BsJob* j) {
  Term list = term_pak(CID(Nil), 0);
  for (u32 i = j->name_count; i; --i) list = io_node(e, CID(Con), io_str(e, j->names[i-1], strlen(j->names[i-1])), list);
  return list;
}
static Term bs_pack(Env e, IoWork* w) {
  BsJob* j = (BsJob*)w->data;
  Term value = term_pak(CID(Unit), 0), result;
  if (j->code) {
    Term error = io_tup(e, j->code, io_str(e, j->message, strlen(j->message)));
    if (j->op == BS_CLOSE) error = io_tup(e, error, io_hand(j->handle));
    result = io_box(e, CID(Fail), error);
  } else {
    switch (j->op) {
      case BS_OPEN: case BS_IMPORT: case BS_PREPARE: value = io_hand(j->created); break;
      case BS_COUNT: case BS_INDEX: value = j->index; break;
      case BS_NAMES: value = bs_names_pack(e, j); break;
      case BS_EXPORT: value = bs_bytes_pack(e, j->bytes, j->byte_count); break;
      case BS_EXECUTE: {
        u64 loc = heap_alloc(e, 2);
        e.mem[loc] = (u32)j->changes; e.mem[loc+1] = (u32)((uint64_t)j->changes >> 32);
        e.mem[loc+2] = (u32)j->last_id; e.mem[loc+3] = (u32)((uint64_t)j->last_id >> 32);
        value = term_ctr(CID(Stats), loc); break;
      }
      case BS_QUERY: {
        Term rows = term_pak(CID(Nil), 0);
        for (u64 i = j->row_count; i; --i) rows = io_node(e, CID(Con), bs_row_pack(e, &j->rows[i-1]), rows);
        value = io_node(e, CID(Rows), bs_names_pack(e, j), rows); break;
      }
      case BS_STEP: value = j->row_count ? io_box(e, CID(Some), bs_row_pack(e, j->rows)) : term_pak(CID(None), 0); break;
    }
    result = io_done(e, value);
  }
  if (j->op != BS_OPEN && j->op != BS_IMPORT && j->op != BS_CLOSE && j->op != BS_FINALIZE)
    result = io_tup(e, io_hand(j->handle), result);
  bs_job_free(j); w->data = NULL;
  return result;
}
static Term bs_run(Env e, Term* f, IoWork* w, int op) {
  BsJob* j = io_mem(calloc(1, sizeof(*j))); j->op = op; w->data = (char*)j;
  bool bad = false;
  if (op != BS_OPEN && op != BS_IMPORT) j->handle = io_hand_v(f[0]);
  if (op == BS_OPEN || op == BS_PREPARE || op == BS_BIND_NAMED || op == BS_INDEX || op == BS_SCRIPT || op == BS_EXECUTE || op == BS_QUERY) {
    j->sql = io_cstr(e, f[op == BS_OPEN ? 0 : 1], &j->sql_size);
    if (io_nul(j->sql, j->sql_size) || j->sql_size >= INT_MAX) bs_error(j, SQLITE_MISUSE, "SQL, paths and parameter names must be NUL-free and shorter than INT_MAX.");
  }
  if (op == BS_OPEN) j->index = term_aux(f[1]) == CID(True);
  if (op == BS_IMPORT) j->bytes = bs_bytes_take(e, f[0], &j->byte_count, &bad);
  if (op == BS_BIND || op == BS_TIMEOUT) j->index = (u32)f[1];
  if (op == BS_BIND || op == BS_BIND_NAMED) {
    j->count = 1; j->values = io_mem(calloc(1, sizeof(BsValue)));
    j->values[0] = bs_value_take(e, f[2], &bad);
  }
  if (op == BS_QUERY || op == BS_EXECUTE) bs_values_take(e, j, f[2], &bad);
  if (bad) bs_error(j, SQLITE_MISUSE, "A byte must be in 0..255.");
  if (!bs_load()) bs_error(j, SQLITE_CANTOPEN, "Cannot load SQLite >= 3.37; check BEND_SQLITE_LIBRARY and the system library.");
  if (j->code) return bs_pack(e, w);
  return io_work(w, bs_call, bs_pack);
}

#ifdef CID(raw.open)
static Term bs_run_open(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_OPEN); }
static void __attribute__((constructor)) bs_use_open(void) { io_eff(CID(raw.open), bs_run_open, 0); }
#endif

#ifdef CID(raw.import)
static Term bs_run_import(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_IMPORT); }
static void __attribute__((constructor)) bs_use_import(void) { io_eff(CID(raw.import), bs_run_import, 0); }
#endif

#ifdef CID(raw.close)
static Term bs_run_close(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_CLOSE); }
static void __attribute__((constructor)) bs_use_close(void) { io_eff(CID(raw.close), bs_run_close, 0); }
#endif

#ifdef CID(raw.finalize)
static Term bs_run_finalize(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_FINALIZE); }
static void __attribute__((constructor)) bs_use_finalize(void) { io_eff(CID(raw.finalize), bs_run_finalize, 0); }
#endif

#ifdef CID(raw.prepare)
static Term bs_run_prepare(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_PREPARE); }
static void __attribute__((constructor)) bs_use_prepare(void) { io_eff(CID(raw.prepare), bs_run_prepare, 0); }
#endif

#ifdef CID(raw.bind)
static Term bs_run_bind(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_BIND); }
static void __attribute__((constructor)) bs_use_bind(void) { io_eff(CID(raw.bind), bs_run_bind, 0); }
#endif

#ifdef CID(raw.bind_named)
static Term bs_run_bind_named(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_BIND_NAMED); }
static void __attribute__((constructor)) bs_use_bind_named(void) { io_eff(CID(raw.bind_named), bs_run_bind_named, 0); }
#endif

#ifdef CID(raw.step)
static Term bs_run_step(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_STEP); }
static void __attribute__((constructor)) bs_use_step(void) { io_eff(CID(raw.step), bs_run_step, 0); }
#endif

#ifdef CID(raw.reset)
static Term bs_run_reset(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_RESET); }
static void __attribute__((constructor)) bs_use_reset(void) { io_eff(CID(raw.reset), bs_run_reset, 0); }
#endif

#ifdef CID(raw.clear_bindings)
static Term bs_run_clear_bindings(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_CLEAR); }
static void __attribute__((constructor)) bs_use_clear_bindings(void) { io_eff(CID(raw.clear_bindings), bs_run_clear_bindings, 0); }
#endif

#ifdef CID(raw.column_names)
static Term bs_run_column_names(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_NAMES); }
static void __attribute__((constructor)) bs_use_column_names(void) { io_eff(CID(raw.column_names), bs_run_column_names, 0); }
#endif

#ifdef CID(raw.parameter_count)
static Term bs_run_parameter_count(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_COUNT); }
static void __attribute__((constructor)) bs_use_parameter_count(void) { io_eff(CID(raw.parameter_count), bs_run_parameter_count, 0); }
#endif

#ifdef CID(raw.parameter_index)
static Term bs_run_parameter_index(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_INDEX); }
static void __attribute__((constructor)) bs_use_parameter_index(void) { io_eff(CID(raw.parameter_index), bs_run_parameter_index, 0); }
#endif

#ifdef CID(raw.script)
static Term bs_run_script(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_SCRIPT); }
static void __attribute__((constructor)) bs_use_script(void) { io_eff(CID(raw.script), bs_run_script, 0); }
#endif

#ifdef CID(raw.execute)
static Term bs_run_execute(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_EXECUTE); }
static void __attribute__((constructor)) bs_use_execute(void) { io_eff(CID(raw.execute), bs_run_execute, 0); }
#endif

#ifdef CID(raw.query)
static Term bs_run_query(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_QUERY); }
static void __attribute__((constructor)) bs_use_query(void) { io_eff(CID(raw.query), bs_run_query, 0); }
#endif

#ifdef CID(raw.busy_timeout)
static Term bs_run_busy_timeout(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_TIMEOUT); }
static void __attribute__((constructor)) bs_use_busy_timeout(void) { io_eff(CID(raw.busy_timeout), bs_run_busy_timeout, 0); }
#endif

#ifdef CID(raw.export)
static Term bs_run_export(Env e, Term* f, IoWork* w) { return bs_run(e, f, w, BS_EXPORT); }
static void __attribute__((constructor)) bs_use_export(void) { io_eff(CID(raw.export), bs_run_export, 0); }
#endif
