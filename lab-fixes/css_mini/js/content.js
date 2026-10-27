/* ==========================================================================
   content.js — OWNER: Meet Mangaonkar
   Purpose: all student-facing text and the quiz (Lab.Content, CONTRACT §5.7).
   A complete first draft: please fact-check, tighten the wording, and replace
   the nine guidelines with the exact wording from the professor's brief.
   Conventions: "simulated" is used consistently; nothing here claims a real
   attack happens. Plain text only (workflow.js inserts it with textContent).
   ========================================================================== */
window.Lab = window.Lab || {};
(function (Lab) {
  'use strict';

  Lab.Content = {
    title: 'SYN Flood Virtual Lab',

    objective: 'Demonstrate the effect of a SYN Flood attack on network availability.',

    disclaimer: 'Everything in this lab is simulated inside your browser. All numbers are educational estimates, not real benchmarks, and no network traffic is sent.',

    // TODO (Meet): replace with the nine "Before You Begin" instructions from the brief.
    guidelines: [
      'This lab is a browser-only simulation. No real network traffic is created and nothing leaves your computer.',
      'All numbers you see are simulated educational estimates, not measurements of a real system.',
      'Work through the nine steps in order. A step unlocks when you finish the one before it.',
      'Read the theory first. You can reopen it at any time with the Theory button in the header.',
      'Always run the baseline before the attack, so you have a healthy server to compare against.',
      'Use Stop to halt a simulation immediately. Your results stay on screen so you can study them.',
      'Change the defences only while no simulation is running.',
      'Use Reset to start the experiment again. If you already have results, you will be asked to confirm.',
      'Use what you learn to defend systems. Never send flood traffic to a network you do not own or have written permission to test.'
    ],

    theory: {
      tcp: 'The Transmission Control Protocol (TCP) is how most of the internet delivers data reliably: web pages, email and file transfers all use it. Before any data moves, the two computers must agree to talk, and TCP does this with a short exchange called the three-way handshake. The computer that starts the conversation is the client. The computer that waits for connections is the server. A server can only keep track of a limited number of connections at once, so each new connection uses a small piece of its memory.',

      handshake: [
        {
          name: 'SYN',
          text: 'The client sends a SYN ("synchronise") message to say: "I would like to open a connection." The server notes the request and sets aside a small amount of memory to remember it.'
        },
        {
          name: 'SYN-ACK',
          text: 'The server replies with a SYN-ACK ("synchronise-acknowledge"): "I received your request, and I am ready." At this point the connection is half-open, because the server is waiting for the client to answer.'
        },
        {
          name: 'ACK',
          text: 'The client sends a final ACK ("acknowledge"): "Got it, let us begin." The connection is now fully established, the server frees the waiting slot, and data can flow.'
        }
      ],

      synFlood: 'In a SYN flood, an attacker sends a huge number of SYN messages but never sends the final ACK. Often the source addresses are spoofed, meaning they are fake, so the server\'s SYN-ACK replies go nowhere. Each unanswered request stays in the server\'s backlog queue as a half-open connection for about 30 seconds before it times out. When the queue is full, the server has no room left and must turn new connections away, including real ones. The attacker does not need to break in or steal anything; filling the queue is enough.',

      availability: 'Availability means that the people who should be able to use a service can use it when they need to. A SYN flood is a denial-of-service attack because it targets availability: the server is still running, but real customers cannot get through. In this lab we measure availability as the percentage of legitimate connection attempts that succeed over the last five simulated seconds. We also watch the queue, the processor load and the response time, which usually get worse before availability collapses.',

      analogy: 'Imagine a pizza shop with a counter that holds 100 orders. Pranksters phone in hundreds of orders with fake names and never come to collect them. The shop keeps each pizza on the counter for half a minute, just in case. Soon the counter is full of orders nobody will pick up, and real customers who walk in are told to come back later. The shop is working perfectly well, but it cannot serve the people it exists for. The counter is the TCP queue, the prank orders are half-open connections, and the turned-away customers are the lost availability.'
    },

    components: {
      client: {
        title: 'Legitimate Client',
        text: 'A normal user whose browser opens connections to the server. Every connection it starts completes the full handshake, so its slot is freed after about one second.'
      },
      generator: {
        title: 'Simulated Traffic Generator',
        text: 'Produces the simulated attack traffic. It sends SYN messages at the rate you choose, and most of them never send the final ACK. No real packets are sent.'
      },
      server: {
        title: 'Target Server',
        text: 'The simulated server that accepts connections. It keeps one slot in its queue for every half-open connection, and its CPU and response time depend on how busy that queue is.'
      },
      queue: {
        title: 'TCP Connection Queue',
        text: 'The backlog of half-open connections waiting for their final ACK. It has 100 slots. Green slots belong to legitimate clients and red slots to the attack. When it is full, new connections are rejected.'
      },
      status: {
        title: 'Network Status Indicator',
        text: 'Summarises the health of the service as Healthy, Under Pressure, Degraded or Unavailable, based on availability, queue use and CPU load.'
      }
    },

    steps: [
      {
        id: 1,
        title: 'Review the lab',
        instructions: 'Read the theory above and press Replay handshake to watch SYN, SYN-ACK and ACK happen. Click each part of the network diagram to see what it does. When you are ready, press Continue.'
      },
      {
        id: 2,
        title: 'Generate baseline traffic',
        instructions: 'Press Generate Baseline Traffic. Watch legitimate clients complete handshakes and notice that the server stays Healthy and the queue stays almost empty. The baseline runs for 20 simulated seconds and is saved for the comparison later.'
      },
      {
        id: 3,
        title: 'Launch the SYN flood',
        instructions: 'Choose an attack level (Low, Medium or High) and press Start SYN Flood. The traffic generator now sends SYN messages that never complete. Try the levels in turn if you like: each run replaces the previous attack.'
      },
      {
        id: 4,
        title: 'Observe the impact',
        instructions: 'Watch the queue fill with red attack slots. Follow the dashboard: pending connections, CPU and response time rise, then availability falls. Note the moment the server becomes Degraded or Unavailable, and check the log for what happened.'
      },
      {
        id: 5,
        title: 'Stop the attack',
        instructions: 'Press Stop whenever you have seen enough, or let the run finish after 40 simulated seconds. The simulation halts at once and every number stays on screen so you can study it.'
      },
      {
        id: 6,
        title: 'Enable mitigation',
        instructions: 'Open the terminal (Terminal button, top right). You are root on the simulated server web01: configure real defences with Linux commands such as sysctl and iptables. Type help to see what is supported. The switches below show which defences your configuration turns on. When at least one is on, press Run With Mitigation to replay the same attack against your configuration.'
      },
      {
        id: 7,
        title: 'Compare the results',
        instructions: 'Study the comparison table and the explanation under it. Which numbers improved most with your defences, and which stayed bad? When you have finished, press Continue.'
      },
      {
        id: 8,
        title: "Defender's workshop",
        instructions: 'The simulation showed what happens. Now learn how a real defender finds and stops it. Work through the five modules below: understand the kernel mechanism, investigate evidence, harden a Linux server with real commands, choose the right defence layers and run the incident. Finish all five to unlock the quiz.'
      },
      {
        id: 9,
        title: 'Test your knowledge',
        instructions: 'Answer the twelve quiz questions. You get feedback after each answer. Finish the quiz to complete the experiment.'
      }
    ],

    serverStates: {
      'Healthy': 'Almost every legitimate connection succeeds and the queue has plenty of room.',
      'Under Pressure': 'The queue or the CPU is getting busy. Service still works, but it has little spare capacity.',
      'Degraded': 'Many legitimate users are failing to connect, or the queue is nearly full. Responses are slow.',
      'Unavailable': 'Almost no legitimate user can connect. The attack has taken the service offline.'
    },

    mitigations: {
      synCookies: {
        title: 'SYN cookies',
        text: 'When the queue is full, the server stops keeping a slot for each new SYN. Instead it encodes the connection details into its SYN-ACK reply, and only creates a real connection if a valid ACK comes back. Genuine clients are still served, while fake ones cost no memory.',
        limitation: 'Each cookie still costs CPU and bandwidth, a few TCP options are lost, and a very large flood can still overwhelm the network link.'
      },
      rateLimit: {
        title: 'Rate limiting',
        text: 'The server or firewall accepts only a fixed number of new connections per second from the same source. Anything above the limit is dropped before it can take a slot, which caps how fast the queue can fill.',
        limitation: 'A limit that is too low also blocks genuine bursts of traffic, and an attacker who spreads the flood over many sources can stay under the limit.'
      },
      shortTimeout: {
        title: 'Shorter timeouts',
        text: 'The server waits less time for the final ACK before it gives up on a half-open connection. Slots occupied by attack traffic are freed within seconds instead of half a minute, so the queue struggles to fill.',
        limitation: 'Slow but genuine clients, for example on poor mobile networks, may be dropped too, and a faster flood simply refills the slots sooner.'
      },
      firewall: {
        title: 'Firewall filtering',
        text: 'A firewall or intrusion-prevention system blocks traffic that matches known attack patterns, such as addresses on a blocklist, before it reaches the server. In this simulation it removes most of the attack SYNs.',
        limitation: 'It cannot tell well-disguised spoofed traffic from real traffic, so some attack packets get through and some genuine ones are blocked by mistake.'
      }
    },

    quiz: [
      {
        id: 1,
        question: 'In which order are the messages of the TCP three-way handshake sent?',
        options: ['ACK, SYN, SYN-ACK', 'SYN, SYN-ACK, ACK', 'SYN, ACK, SYN-ACK', 'SYN-ACK, SYN, ACK'],
        answer: 1,
        explanation: 'The client sends SYN, the server answers with SYN-ACK, and the client finishes with ACK. Only after the final ACK is the connection established. A SYN flood abuses the gap between the second and third message.'
      },
      {
        id: 2,
        question: 'Why does a half-open connection use up server resources?',
        options: [
          'It downloads a large file to the server',
          'The server keeps a slot in its queue while it waits for the final ACK',
          'It encrypts all later traffic with a heavy algorithm',
          'It permanently blocks the client\'s address'
        ],
        answer: 1,
        explanation: 'For every SYN it accepts, the server stores state and keeps it until the handshake completes or times out. Many half-open connections therefore mean many occupied slots, even though no data was ever sent.'
      },
      {
        id: 3,
        question: 'What is the main effect of a successful SYN flood on a service?',
        options: [
          'Stored data is stolen from the server',
          'The server\'s files are encrypted and held for ransom',
          'Legitimate users can no longer connect, so availability falls',
          'The server\'s clock is changed'
        ],
        answer: 2,
        explanation: 'A SYN flood is a denial-of-service attack. It does not need to steal or change data. It only has to fill the connection queue so that genuine users are turned away, which is a loss of availability.'
      },
      {
        id: 4,
        question: 'How does attack traffic differ from legitimate traffic in this lab?',
        options: [
          'Attack clients send SYN messages but most never send the final ACK',
          'Attack traffic uses a different protocol from TCP',
          'Attack traffic is always much slower than legitimate traffic',
          'Legitimate clients never send a SYN message'
        ],
        answer: 0,
        explanation: 'Both kinds of traffic start with a SYN. Legitimate clients complete the handshake, so their slot is freed after about a second. Attack traffic leaves most connections half-open, so their slots stay occupied until the timeout.'
      },
      {
        id: 5,
        question: 'What problem do SYN cookies solve?',
        options: [
          'They make the SYN-ACK message encrypted',
          'They stop the attacker from ever sending a SYN',
          'They let the server answer SYNs without keeping a queue slot for each one',
          'They shorten the handshake to two messages'
        ],
        answer: 2,
        explanation: 'With SYN cookies the server stores no state at first. It hides the needed details in the SYN-ACK, so a full queue no longer blocks genuine clients. The attacker can still send SYNs, and each cookie still costs some CPU.'
      },
      {
        id: 6,
        question: 'Why can no single defence fully prevent denial-of-service attacks?',
        options: [
          'Defences only work when the server is switched off',
          'Each defence has limits, and attackers can adapt, spread their traffic or add more of it',
          'Denial-of-service attacks always use stolen passwords',
          'Defences are only available for UDP traffic'
        ],
        answer: 1,
        explanation: 'Every defence trades something off: cookies cost CPU, rate limits can block real bursts, shorter timeouts can drop slow clients, and firewalls miss disguised traffic. Real systems layer several defences and still have to plan for incidents.'
      }
    ],

    completion: {
      title: 'Experiment Completed Successfully!',
      message: 'You generated a baseline, launched a simulated SYN flood, watched the queue fill and the service fail, and measured how defences help. The key lesson: a SYN flood does not break into a server, it simply uses up a limited resource, and defence in depth is the best protection.'
    }
  };
})(window.Lab);
