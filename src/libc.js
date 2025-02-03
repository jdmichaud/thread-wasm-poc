export let libc_instance;

// memory starts at index 1.
// Index 0 is reserved to indicate a NULL pointer.
// Index 1 is reserved. ~~ to indicate the brk (first used address).~~
// memory is reserved as blocks. Each block contains a header and an allocated
// memory region.
// The header is composed of 9 bytes:
// [ byte 0 ][byte 1-4][byte 4-8][... memory region ...]
//  ┃         ┃         ┗ The address of the header for the next block
//  ┃         ┗ Size of the block
//  ┗━ Flags:
//      bit  0: is the block is used or not (1 === used)
//      bits 1..7: reserved

// Once initialized, the memory will look like this
// [0][2][0x0000][memory size - 1 - header size][0]
// After malloc(10)
// [0][2][0x0001][10][21][..........][0x0000][memory size - 11 - header size * 2][0]

const HEADER_SIZE = 9;
const SIZE_INDEX = 1;
const NEXT_INDEX = 5;

const BRK_INDEX = 1;
const FIRST_BLOCK_INDEX = BRK_INDEX + 1;

const MIN_BLOCK_SIZE = 16;

export const NULL = 0;

export function libc_init(memory) {
  if (libc_instance === undefined) {
    console.log('instantiate libc');
    const memview = new DataView(memory.buffer);
    if (memview.getUint8(BRK_INDEX) === 0) {
      // Memory is uninitialized, set Index 1 to 2, the first used address
      memview.setUint8(BRK_INDEX, FIRST_BLOCK_INDEX);
      // Set the size of the used block (here the entire memory)
      memview.setUint32(FIRST_BLOCK_INDEX + SIZE_INDEX, memview.byteLength - FIRST_BLOCK_INDEX - HEADER_SIZE);
      // The last block will point next to NULL
      memview.setUint32(FIRST_BLOCK_INDEX + NEXT_INDEX, 0);
    }

    libc_instance = {
      malloc(size) {
        console.log(`malloc(${size})`);
        if (size === 0) {
          return 0;
        }
        const block = findBlock(memview, size);
        if (block === undefined) {
          console.log(`-> 0`);
          // printBlocks(memview);
          return 0;
        }
        // If the block size is equal to the requested size, just set the used flag
        if (block.size === size) {
          setBlockHeader(memview, block.ptr, {
            used: 0x0001,
            size: block.size,
            next: block.next,
          });
          console.log(`-> ${toPrettyHex(block.region)}`);
          // printBlocks(memview);
          return block.region;
        }
        // We split the block into two smaller block
        let nextBlockPtr = block.ptr + HEADER_SIZE + size;
        setBlockHeader(memview, nextBlockPtr, {
          used: 0,
          size: block.size - (size + HEADER_SIZE),
          next: block.next,
        });
        // Now set the new block
        setBlockHeader(memview, block.ptr, {
          used: 0x0001,
          size,
          next: nextBlockPtr,
        });
        console.log(`-> ${toPrettyHex(block.region)}`);
        // printBlocks(memview);
        return block.region;
      },
      free(ptr) {
        console.log(`free(${toPrettyHex(ptr)})`);
        if (ptr === 0) {
          return;
        }
        const header = ptr - HEADER_SIZE;
        // Set used flag to 0
        memview.setUint8(header, memview.getUint8(header) & 0xFFFE);
        // FIXME: we should be doing some block merging here to reduce fragmentation
        // printBlocks(memview);
      }
    };
  }

  return libc_instance;
}

function setBlockHeader(memview, ptr, params) {
  memview.setUint8(ptr, params.used ? 0x0001 : 0);
  memview.setUint32(ptr + SIZE_INDEX, params.size);
  memview.setUint32(ptr + NEXT_INDEX, params.next);
}

export function nextBlock(memview, ptr = FIRST_BLOCK_INDEX) {
  if (ptr !== 0 && ptr < memview.byteLength) {
    const used = memview.getUint8(ptr);
    const size = memview.getUint32(ptr + SIZE_INDEX);
    const next = memview.getUint32(ptr + NEXT_INDEX);
    return { ptr, used, size, next, region: ptr + HEADER_SIZE };
  }
  return undefined;
}

function findBlock(memview, size) {
  let found = false;
  let ptr = FIRST_BLOCK_INDEX;
  let block = undefined;

  do {
    block = nextBlock(memview, ptr);
    if (block === undefined) {
      // No more memory
      return undefined;
    }
    // A block is good to use either if it has exactly the same size (in which
    // case the block will not be split) or its size is greater than the
    // requested size plus the necessary HEADER_SIZE for the new split plus the
    // minimum block size to prevent too much fragmentation.
    if (!block.used && (block.size == size || block.size >= (size + HEADER_SIZE + MIN_BLOCK_SIZE))) {
      return block;
    }
    ptr = block.next;
  } while (ptr !== 0 && block !== undefined);

  return undefined;
}

function toPrettyHex(value) {
  return value !== undefined ? `0x${value.toString(16).padStart(8, '0')}` : 'undefined';
};

// For debug purposes
export function printBlocks(memory) {
  const memview = new DataView(memory.buffer);
  let block = nextBlock(memview);
  do {
    console.log(`${toPrettyHex(block.ptr)} ${block.used ? '    used' : 'not used'} ${block.size.toString(10).padStart(10, ' ')} ${toPrettyHex(block.next)} ${toPrettyHex(block.region)}`);
    block = nextBlock(memview, block.next);
  } while (block !== undefined);
}
