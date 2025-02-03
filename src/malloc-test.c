extern unsigned char __heap_base;

extern void *malloc(unsigned long size);
extern void free(void *);

__attribute__ ((visibility("default")))
void *get_heap_base(void) {
  return &__heap_base;
}

// Define a simple pseudo-random number generator (PRNG) for random behavior
static unsigned int seed = 123456789;  // Initial seed value

// Simple PRNG function
unsigned int my_rand() {
  seed = seed * 1664525 + 1013904223;  // Linear congruential generator
  return seed;
}

// Helper function to simulate random malloc and free operations
void malloc_test(unsigned int n, unsigned int max) {
  void* pointers[n];  // Array to store pointers for free operations
  unsigned int ptr_count = 0;  // Keep track of the number of allocated pointers

  for (unsigned int i = 0; i < n; ++i) {
    // Randomly decide whether to call malloc or free
    if ((my_rand() % max) < (max / 2) && ptr_count < n) {  // 50% chance to malloc
      unsigned int size = my_rand() % max + 1;  // Random size between 1 and 1024
      void* ptr = malloc(size);  // Call your custom malloc
      if (ptr) {
         pointers[ptr_count++] = ptr;  // Store the pointer for later free
      }
    } else if (ptr_count > 0) {  // Free only if we have pointers to free
     unsigned int idx = my_rand() % ptr_count;  // Pick a random pointer index
     free(pointers[idx]);  // Call your custom free
     // Remove the freed pointer by swapping it with the last one
     pointers[idx] = pointers[--ptr_count];
    }
  }
}
