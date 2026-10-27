#!/usr/bin/env python3
import json
import sys
import urllib.request
import urllib.error
import http.cookiejar

LABS = [
    {
        "title": "RSA Cryptosystem: Factoring Challenge & Chosen Ciphertext Attack",
        "description": "A self-contained virtual lab on the RSA public-key cryptosystem demonstrating semiprime modulus generation, prime factorization vulnerabilities, and Chosen Ciphertext Attack (CCA) on unpadded RSA.",
        "category": "Cryptography",
        "difficulty": "Intermediate",
        "github_url": "https://github.com/CarinLemos20/CSS-lab-simulation",
        "github_repo_name": "CSS-lab-simulation",
        "github_issue_url": "https://github.com/CarinLemos20/CSS-lab-simulation/issues",
        "aim": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/README.md",
        "theory": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/README.md",
        "objective": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/README.md",
        "procedure": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/README.md",
        "references": "https://raw.githubusercontent.com/CarinLemos20/CSS-lab-simulation/main/README.md"
    },
    {
        "title": "Virtual Network Security Lab: DoS & DDoS Attacks and Mitigation",
        "description": "Hands-on simulation of Denial of Service (SYN Flood/UDP Flood) and Distributed Denial of Service attacks on network infrastructure, demonstrating traffic analysis, server saturation, and firewall/rate-limiting protections.",
        "category": "Network",
        "difficulty": "Intermediate",
        "github_url": "https://github.com/Xombi17/css-virtual-lab",
        "github_repo_name": "css-virtual-lab",
        "github_issue_url": "https://github.com/Xombi17/css-virtual-lab/issues",
        "aim": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/docs/aim.md",
        "theory": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/docs/theory.md",
        "objective": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/docs/objective.md",
        "procedure": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/docs/procedure.md",
        "references": "https://raw.githubusercontent.com/Xombi17/css-virtual-lab/main/docs/references.md"
    },
    {
        "title": "Buffer Overflow Attack: Stack Smashing & Control Flow Hijacking",
        "description": "Interactive Docker-isolated educational lab demonstrating classic stack-based buffer overflow vulnerabilities in C, return address overwriting, control-flow hijacking, and memory-safety mitigations.",
        "category": "System",
        "difficulty": "Intermediate",
        "github_url": "https://github.com/beeth73/CSS-LAB-BOA",
        "github_repo_name": "CSS-LAB-BOA",
        "github_issue_url": "https://github.com/beeth73/CSS-LAB-BOA/issues",
        "aim": "https://raw.githubusercontent.com/beeth73/CSS-LAB-BOA/main/README.md",
        "theory": "https://raw.githubusercontent.com/beeth73/CSS-LAB-BOA/main/docs/theory.md",
        "objective": "https://raw.githubusercontent.com/beeth73/CSS-LAB-BOA/main/README.md",
        "procedure": "https://raw.githubusercontent.com/beeth73/CSS-LAB-BOA/main/GETTING_STARTED.md",
        "references": "https://raw.githubusercontent.com/beeth73/CSS-LAB-BOA/main/docs/references.md"
    },
    {
        "title": "TCP SYN Flood Attack & Defense Simulation",
        "description": "Interactive simulation demonstrating how TCP half-open connections exhaust server backlog queues during a SYN flood attack, and how SYN cookies, backlog expansion, and rate limiting restore availability.",
        "category": "Network",
        "difficulty": "Beginner",
        "github_url": "https://github.com/ManvithKarkera/css_mini",
        "github_repo_name": "css_mini",
        "github_issue_url": "https://github.com/ManvithKarkera/css_mini/issues",
        "aim": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/README.md",
        "theory": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/README.md",
        "objective": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/README.md",
        "procedure": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/CONTRACT.md",
        "references": "https://raw.githubusercontent.com/ManvithKarkera/css_mini/main/README.md"
    }
]

def check_server(base_url="http://localhost:8000"):
    try:
        req = urllib.request.Request(base_url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False

def upload_lab(lab, base_url="http://localhost:8000"):
    import base64
    auth_header = "Basic " + base64.b64encode(b"admin:admin123").decode("ascii")
    
    # Try 1: JSON POST to /upload
    headers = {
        "Content-Type": "application/json",
        "Authorization": auth_header,
        "User-Agent": "CyberLabUploader/1.0"
    }
    data = json.dumps(lab).encode("utf-8")
    
    req = urllib.request.Request(f"{base_url}/upload", data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"✓ Uploaded '{lab['title']}' via JSON: HTTP {resp.status}")
            return True
    except urllib.error.HTTPError as e:
        # Try 2: Form POST
        form_data = urllib.parse.urlencode(lab).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        req2 = urllib.request.Request(f"{base_url}/upload", data=form_data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req2, timeout=5) as resp2:
                print(f"✓ Uploaded '{lab['title']}' via Form: HTTP {resp2.status}")
                return True
        except Exception as e2:
            print(f"✗ Failed to upload '{lab['title']}': {e2}")
            return False
    except Exception as e:
        print(f"✗ Failed to upload '{lab['title']}': {e}")
        return False

if __name__ == "__main__":
    print(f"Checking server at http://localhost:8000...")
    running = check_server()
    if not running:
        print("Server at http://localhost:8000 is not currently running.")
        print("Here are the ready-to-upload JSON payloads:\n")
        print(json.dumps(LABS, indent=2))
        sys.exit(0)
    
    print("Server is active! Uploading labs...")
    for lab in LABS:
        upload_lab(lab)
