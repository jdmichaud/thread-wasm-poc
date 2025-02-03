// extern void addString(const char *offset, unsigned int size);
// extern void printString();

extern unsigned char __heap_base;

__attribute__ ((visibility("default")))
void *get_heap_base(void) {
  return &__heap_base;
}

unsigned long fibonacci(int n) {
  // print 3rd to nth terms
  unsigned long t1 = 0;
  unsigned long t2 = 1;
  unsigned long nextTerm = t1 + t2;

  for(unsigned int i = 3; i <= n; ++i) {
    t1 = t2;
    t2 = nextTerm;
    nextTerm = t1 + t2;
  }
  return nextTerm;
}
