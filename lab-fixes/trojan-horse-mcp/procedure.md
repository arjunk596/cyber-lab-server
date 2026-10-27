# Laboratory Procedure

1. **Step 1: Inspect Execution Mode**
   - Review the Containment Mode toggle on the experiment board.
   - Contrast uncontained host execution with container sandbox isolation.

2. **Step 2: Simulate Injected Command**
   - Provide an attacker command such as `cat ~/.ssh/id_rsa` or `env | grep TOKEN`.
   - Click **Trigger Trojan Payload** in uncontained mode to observe simulated host exposure.

3. **Step 3: Enable Docker Sandbox Isolation**
   - Switch the mode toggle to **Docker Sandbox Isolation**.
   - Re-run the payload to observe boundary rejection: host SSH keys are invisible inside the disposable container.

4. **Step 4: Launch Real Container Service**
   - Click **Launch Container** in the terminal drawer.
   - Run `curl -s http://127.0.0.1:7331/tools` to inspect registered MCP tool capabilities.
