# Theory — Buffer Overflow Vulnerabilities & Stack Corruption

## 1. Process Memory Architecture
When an x86/x64 program runs, its virtual memory is divided into four major segments:
- **Text (Code) Segment**: Read-only region containing machine instructions.
- **Data & BSS Segments**: Initialized and uninitialized global and static variables.
- **Heap Segment**: Dynamically allocated memory (`malloc`, `new`) that grows upwards toward higher addresses.
- **Stack Segment**: Dynamic LIFO region storing local variables, function parameters, frame pointers (EBP), and return addresses (EIP). The stack grows downwards from high addresses to low addresses.

## 2. Stack Frame Anatomy
When a function is called:
1. Function arguments are pushed onto the stack in reverse order (right-to-left).
2. The `CALL` instruction pushes the **Return Address (EIP)** onto the stack.
3. The function prologue executes:
   ```assembly
   push ebp        ; Save caller's frame pointer
   mov ebp, esp    ; Set new frame pointer
   sub esp, 0x10   ; Allocate space for local buffer
   ```
4. Local arrays and variables are allocated beneath EBP.

## 3. The Vulnerability Mechanism
C and C++ do not perform automatic array bounds checking. Unsafe functions such as `gets()`, `strcpy()`, `sprintf()`, and `scanf("%s")` continue reading and writing input bytes until encountering a null byte or newline, regardless of the allocated destination buffer size.

When input exceeds the allocated buffer size:
1. Overflow bytes spill beyond the buffer boundary.
2. Contiguous local variables are overwritten first (e.g., control flags like `authenticated`).
3. Additional padding overwrites the Saved Frame Pointer (EBP).
4. Subsequent bytes overwrite the **Saved Return Address (EIP)**.

## 4. Control Flow Hijacking
When the function executes `RET`, the CPU pops the value at ESP into the Instruction Pointer (EIP). If the attacker overwrote this address with the address of an administrative function (e.g., `unlock_root()`) or shellcode in an executable stack, execution jumps directly to the attacker's payload.

## 5. Modern Mitigations
- **Stack Canaries (`-fstack-protector`)**: Placing random secret canary values immediately before EBP.
- **Non-Executable Stack (NX / DEP)**: Marking stack pages as Read/Write but non-executable (`W^X`).
- **Address Space Layout Randomization (ASLR)**: Randomizing the base addresses of the stack, heap, and libraries.
