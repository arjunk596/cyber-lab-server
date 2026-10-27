# Objectives

1. **Stack Memory Architecture**: Examine function call stack frames, including local buffer allocations, saved base pointers (`EBP`/`RBP`), and saved return addresses.
2. **Buffer Boundary Violation**: Exploit unsafe C standard library functions (e.g., `strcpy`, `gets`, `scanf`) to exceed allocated buffer boundaries.
3. **Control-Flow Hijack**: Calculate exact byte offsets using cyclic patterns to overwrite the saved return address and redirect execution to a target payload function.
4. **Interactive Sandbox Debugging**: Use an embedded GDB debugger and xterm terminal to inspect register values and stack layout in real time.
5. **Compiler Mitigations**: Understand and test defense mechanisms, including Stack Canaries (`-fstack-protector`), Non-Executable Stack (`NX`/`DEP`), and Address Space Layout Randomization (ASLR).
