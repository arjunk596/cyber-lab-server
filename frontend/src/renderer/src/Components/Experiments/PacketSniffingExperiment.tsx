import React, { useState } from 'react'
import {
  Network,
  Radio,
  Lock,
  Laptop,
  Skull,
  Server,
  Play,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import type { Experiment } from '@shared/experiment'
import '../../Sass/Components/PacketSniffingExperiment.scss'

export interface PacketSniffingExperimentProps {
  experiment: Experiment
  onOpenTerminal?: () => void
  onComplete?: () => void
}

interface CapturedPacket {
  id: number
  time: string
  src: string
  dst: string
  srcMac: string
  dstMac: string
  proto: 'TCP' | 'HTTP' | 'TLS 1.3' | 'ARP' | 'DNS'
  len: number
  info: string
  payloadHex: string
  payloadAscii: string
}

export const PacketSniffingExperiment: React.FC<PacketSniffingExperimentProps> = () => {
  const [activeModule, setActiveModule] = useState<'sniff' | 'crypto' | 'arp'>('sniff')

  // Module 1: Promiscuous Sniffing
  const [promiscuous, setPromiscuous] = useState<boolean>(false)
  const [capturedPackets, setCapturedPackets] = useState<CapturedPacket[]>([
    {
      id: 1,
      time: '12:04:15.120',
      src: '192.168.1.50',
      dst: '192.168.1.1',
      srcMac: 'aa:bb:cc:11:22:33',
      dstMac: '00:11:22:33:44:55',
      proto: 'TCP',
      len: 74,
      info: '54231 -> 80 [SYN] Seq=0 Win=64240',
      payloadHex: '00 11 22 33 44 55 aa bb cc 11 22 33 08 00 45 00',
      payloadAscii: '.."3DU.......E.'
    },
    {
      id: 2,
      time: '12:04:16.840',
      src: '192.168.1.50',
      dst: '8.8.8.8',
      srcMac: 'aa:bb:cc:11:22:33',
      dstMac: '00:11:22:33:44:55',
      proto: 'DNS',
      len: 68,
      info: 'Standard query 0x1a2b A cyberlab.crce.ac.in',
      payloadHex: '1a 2b 01 00 00 01 00 00 00 00 00 00 08 63 79 62',
      payloadAscii: '.+...........cyb'
    }
  ])
  const [selectedPacket, setSelectedPacket] = useState<CapturedPacket | null>(null)

  // Module 2: Cleartext vs TLS
  const [trafficMode, setTrafficMode] = useState<'http' | 'https'>('http')

  // Module 3: ARP Poisoning
  const [isArpPoisoned, setIsArpPoisoned] = useState<boolean>(false)
  const [arpLogs, setArpLogs] = useState<string[]>([
    '[*] ARP Monitoring service bound to interface eth0 (192.168.1.0/24)',
    '[*] Legitimate Gateway 192.168.1.1 mapped to 00:11:22:33:44:55'
  ])

  const handleCapturePacket = () => {
    const pool: Omit<CapturedPacket, 'id' | 'time'>[] = [
      {
        src: '192.168.1.50',
        dst: '192.168.1.100',
        srcMac: 'aa:bb:cc:11:22:33',
        dstMac: '00:0c:29:4f:8e:1a',
        proto: 'HTTP',
        len: 320,
        info: 'POST /api/login HTTP/1.1 (CRCE Portal Auth)',
        payloadHex: '50 4f 53 54 20 2f 61 70 69 2f 6c 6f 67 69 6e 20',
        payloadAscii: 'POST /api/login '
      },
      {
        src: '192.168.1.50',
        dst: '142.250.190.46',
        srcMac: 'aa:bb:cc:11:22:33',
        dstMac: '00:11:22:33:44:55',
        proto: 'TLS 1.3',
        len: 512,
        info: 'Application Data Protocol: Encrypted Handshake',
        payloadHex: '17 03 03 01 e8 4a 8f 2c b1 09 dc fa 99 12 3a bc',
        payloadAscii: '.....J.,......:.'
      },
      {
        src: '00:11:22:33:44:55',
        dst: 'ff:ff:ff:ff:ff:ff',
        srcMac: '00:11:22:33:44:55',
        dstMac: 'ff:ff:ff:ff:ff:ff',
        proto: 'ARP',
        len: 42,
        info: 'Who has 192.168.1.50? Tell 192.168.1.1',
        payloadHex: '00 01 08 00 06 04 00 01 00 11 22 33 44 55 c0 a8',
        payloadAscii: '.........."3DU..'
      }
    ]

    const choice = pool[Math.floor(Math.random() * pool.length)]
    const now = new Date().toTimeString().split(' ')[0] + '.' + Math.floor(Math.random() * 900 + 100)
    const newPkt: CapturedPacket = {
      id: capturedPackets.length + 1,
      time: now,
      ...choice
    }
    setCapturedPackets((prev) => [newPkt, ...prev.slice(0, 19)])
    setSelectedPacket(newPkt)
  }

  const handlePoisonArp = () => {
    setIsArpPoisoned(true)
    setArpLogs((prev) => [
      `[!] [${new Date().toTimeString().split(' ')[0]}] BROADCAST Gratuitous ARP: 192.168.1.1 is at ee:ee:ee:aa:bb:cc`,
      `[!] Victim 192.168.1.50 ARP cache poisoned! Default gateway redirected to Attacker node.`,
      `[*] All outbound LAN traffic now intercepted by Attacker (MITM).`,
      ...prev
    ])
  }

  const handleRestoreArp = () => {
    setIsArpPoisoned(false)
    setArpLogs((prev) => [
      `[+] [${new Date().toTimeString().split(' ')[0]}] UNICAST Clean ARP: 192.168.1.1 is restored to 00:11:22:33:44:55`,
      `[+] Victim ARP cache cleaned. Legitimate routing restored.`,
      ...prev
    ])
  }

  return (
    <div className="packet-lab-view">
      {/* Module Selector Pills */}
      <div className="packet-module-tabs">
        <button
          type="button"
          className={`pkt-tab ${activeModule === 'sniff' ? 'active' : ''}`}
          onClick={() => setActiveModule('sniff')}
        >
          <Radio size={14} />
          <span>Module 1: Promiscuous Sniffing</span>
        </button>
        <button
          type="button"
          className={`pkt-tab ${activeModule === 'crypto' ? 'active' : ''}`}
          onClick={() => setActiveModule('crypto')}
        >
          <Lock size={14} />
          <span>Module 2: Cleartext vs TLS 1.3</span>
        </button>
        <button
          type="button"
          className={`pkt-tab ${activeModule === 'arp' ? 'active' : ''}`}
          onClick={() => setActiveModule('arp')}
        >
          <Network size={14} />
          <span>Module 3: ARP Cache Poisoning (MITM)</span>
        </button>
      </div>

      {/* MODULE 1: Promiscuous Sniffer */}
      {activeModule === 'sniff' && (
        <div className="packet-module-content">
          <div className="pkt-card">
            <div className="card-top-header">
              <div className="header-icon-box">
                <Radio size={18} />
              </div>
              <div className="header-text-flex">
                <div>
                  <h3>Network Interface Sniffer (eth0)</h3>
                  <span className="card-subtitle">Local IP: 192.168.1.100 &nbsp;•&nbsp; MAC: 00:0c:29:4f:8e:1a</span>
                </div>
                <div className="controls-row">
                  <button
                    type="button"
                    className={`promisc-toggle-btn ${promiscuous ? 'active-promisc' : ''}`}
                    onClick={() => setPromiscuous(!promiscuous)}
                  >
                    Promiscuous Mode: {promiscuous ? 'ON (Capture All)' : 'OFF (Own MAC Only)'}
                  </button>
                  <button type="button" className="pkt-btn" onClick={handleCapturePacket}>
                    <Play size={13} />
                    <span>Capture Next Packet</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Packets Table */}
            <div className="packets-table-wrap">
              <table className="packets-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Source IP</th>
                    <th>Destination IP</th>
                    <th>Protocol</th>
                    <th>Length</th>
                    <th>Packet Telemetry Info</th>
                  </tr>
                </thead>
                <tbody>
                  {capturedPackets.map((pkt) => (
                    <tr
                      key={pkt.id}
                      className={selectedPacket?.id === pkt.id ? 'row-selected' : ''}
                      onClick={() => setSelectedPacket(pkt)}
                    >
                      <td className="col-mono">{pkt.time}</td>
                      <td className="col-mono">{pkt.src}</td>
                      <td className="col-mono">{pkt.dst}</td>
                      <td>
                        <span className={`proto-badge proto-${pkt.proto.replace(/\s+/g, '').toLowerCase()}`}>
                          {pkt.proto}
                        </span>
                      </td>
                      <td className="col-mono">{pkt.len} B</td>
                      <td>{pkt.info}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Selected Packet Dissection Inspector */}
            {selectedPacket && (
              <div className="packet-inspector">
                <h4>Packet Anatomy & Dissection Inspector</h4>
                <div className="dissection-grid">
                  <div className="dissect-box">
                    <span className="dissect-title">Ethernet II Frame Header</span>
                    <div>Source MAC: <code>{selectedPacket.srcMac}</code></div>
                    <div>Destination MAC: <code>{selectedPacket.dstMac}</code></div>
                    <div>EtherType: <code>0x0800 (IPv4)</code></div>
                  </div>
                  <div className="dissect-box">
                    <span className="dissect-title">Network & Transport Layer</span>
                    <div>Source: <code>{selectedPacket.src}</code></div>
                    <div>Destination: <code>{selectedPacket.dst}</code></div>
                    <div>Protocol: <code>{selectedPacket.proto}</code></div>
                  </div>
                </div>
                <div className="hex-dump-box">
                  <span className="dump-label">Raw Packet Payload (Hex & ASCII Dump):</span>
                  <pre>
                    <code>{selectedPacket.payloadHex}   |{selectedPacket.payloadAscii}|</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODULE 2: Cleartext HTTP vs Encrypted TLS 1.3 */}
      {activeModule === 'crypto' && (
        <div className="packet-module-content">
          <div className="pkt-card">
            <div className="card-top-header">
              <div className="header-icon-box">
                <Lock size={18} />
              </div>
              <div>
                <h3>Cleartext Vulnerability vs TLS 1.3 Cryptographic Protection</h3>
                <span className="card-subtitle">Observe credential leakage across the wire</span>
              </div>
            </div>

            <div className="crypto-compare-controls">
              <button
                type="button"
                className={`compare-btn ${trafficMode === 'http' ? 'active-danger' : ''}`}
                onClick={() => setTrafficMode('http')}
              >
                Transmit Unencrypted HTTP (Port 80)
              </button>
              <button
                type="button"
                className={`compare-btn ${trafficMode === 'https' ? 'active-success' : ''}`}
                onClick={() => setTrafficMode('https')}
              >
                Transmit Encrypted HTTPS / TLS 1.3 (Port 443)
              </button>
            </div>

            <div className="crypto-two-col">
              <div className="wire-box">
                <span className="box-tag">Wire Telemetry (As Observed by Sniffer)</span>
                {trafficMode === 'http' ? (
                  <pre className="wire-code cleartext-leak">
                    {`POST /api/v1/auth/login HTTP/1.1
Host: 192.168.1.100
User-Agent: Mozilla/5.0
Content-Type: application/x-www-form-urlencoded
Content-Length: 43

username=admin&password=SuperSecretPassword123!`}
                  </pre>
                ) : (
                  <pre className="wire-code ciphertext-safe">
                    {`TLSv1.3 Record Layer: Application Data Protocol
Length: 128
Encrypted Record:
17 03 03 00 80 a2 4f 9e 11 cc fa 90 28 dd 12 b4
77 9e 12 3a 4f cc 91 88 a3 5e 81 29 cc fa 90 12
-- [Payload encrypted with ChaCha20-Poly1305 / AES-256-GCM] --
Plaintext authentication parameters are completely concealed.`}
                  </pre>
                )}
              </div>

              <div className="analysis-box">
                <span className="box-tag">Security Impact Assessment</span>
                {trafficMode === 'http' ? (
                  <div className="alert-callout callout-danger">
                    <AlertTriangle size={20} />
                    <div>
                      <strong>CRITICAL VULNERABILITY CONFIRMED:</strong>
                      <p>
                        User credentials (<code>admin</code> / <code>SuperSecretPassword123!</code>) were
                        transmitted in cleartext. Anyone on the local WiFi or LAN segment can steal session
                        tokens and credentials passively without triggering any alarms!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="alert-callout callout-success">
                    <CheckCircle2 size={20} />
                    <div>
                      <strong>TRANSPORT SECURITY VERIFIED (TLS 1.3):</strong>
                      <p>
                        ECDHE key exchange and authenticated encryption prevent passive eavesdropping.
                        Even if the packet is intercepted, the attacker sees only random ciphertext bytes.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODULE 3: ARP Cache Poisoning */}
      {activeModule === 'arp' && (
        <div className="packet-module-content">
          <div className="pkt-card">
            <div className="card-top-header">
              <div className="header-icon-box danger-box">
                <Network size={18} />
              </div>
              <div>
                <h3>ARP Cache Poisoning & Man-in-the-Middle (MITM)</h3>
                <span className="card-subtitle">Spoofing Layer 2 Address Resolution</span>
              </div>
            </div>

            {/* Network Diagram */}
            <div className="arp-topology">
              <div className="topo-node">
                <div className="node-icon-box">
                  <Laptop size={20} />
                </div>
                <strong>Victim PC</strong>
                <code>192.168.1.50</code>
                <span className="mac-text">aa:bb:cc:11:22:33</span>
              </div>

              <div className={`topo-node attacker ${isArpPoisoned ? 'poisoning-pulse' : ''}`}>
                <div className="node-icon-box">
                  <Skull size={20} />
                </div>
                <strong>Attacker Node</strong>
                <code>192.168.1.66</code>
                <span className="mac-text">ee:ee:ee:aa:bb:cc</span>
                {isArpPoisoned && <span className="mitm-active-pill">MITM Active</span>}
              </div>

              <div className="topo-node">
                <div className="node-icon-box">
                  <Server size={20} />
                </div>
                <strong>Default Gateway</strong>
                <code>192.168.1.1</code>
                <span className="mac-text">00:11:22:33:44:55</span>
              </div>
            </div>

            {/* Poison / Restore Controls */}
            <div className="arp-actions-row">
              <button
                type="button"
                className="arp-btn poison-btn"
                onClick={handlePoisonArp}
                disabled={isArpPoisoned}
              >
                Broadcast Spoofed Gratuitous ARP Reply
              </button>
              <button
                type="button"
                className="arp-btn restore-btn"
                onClick={handleRestoreArp}
                disabled={!isArpPoisoned}
              >
                Restore Legitimate Gateway ARP
              </button>
            </div>

            <div className="arp-split-grid">
              {/* Victim ARP Table */}
              <div className="arp-table-box">
                <h4>Victim ARP Cache (192.168.1.50)</h4>
                <table className="arp-cache-table">
                  <thead>
                    <tr>
                      <th>IP Address</th>
                      <th>MAC Hardware Address</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className={isArpPoisoned ? 'poisoned-entry' : ''}>
                      <td>192.168.1.1 (Gateway)</td>
                      <td>
                        <code>{isArpPoisoned ? 'ee:ee:ee:aa:bb:cc' : '00:11:22:33:44:55'}</code>
                      </td>
                      <td>
                        <span className={`arp-tag ${isArpPoisoned ? 'tag-poisoned' : 'tag-legit'}`}>
                          {isArpPoisoned ? 'POISONED (Attacker MAC)' : 'Dynamic (Legitimate)'}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>192.168.1.66</td>
                      <td><code>ee:ee:ee:aa:bb:cc</code></td>
                      <td><span className="arp-tag tag-legit">Dynamic</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* MITM Log Box */}
              <div className="arp-log-box">
                <h4>Interception & Telemetry Log</h4>
                <pre className="arp-log-stream">
                  {arpLogs.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PacketSniffingExperiment
