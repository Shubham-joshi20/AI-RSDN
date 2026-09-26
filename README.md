
# AIRSDN: AI-Based Routing in Software Defined Networks for Multimedia Traffic Transmission

> **Authors:** Amit Nishad, Nikhilesh Joshi, Nikhil Bansal, Shubham Joshi  
> **Project Proposal:** Advanced Algorithm Project

## Project Documents

- [Software Requirements Specification](SRS.md)
- [Implementation Plan and Step-by-Step Procedure](IMPLEMENTATION_PLAN.md)

---

## 📌 Project Overview
Traditional routing relies heavily on hop count, which often leads to congested paths causing delays, packet loss, and poor video quality during high-bandwidth streaming[cite: 1]. **AIRSDN** uses Machine Learning dynamically to select less-congested network paths, ensuring that video data is transmitted with lower delay, better throughput, and superior video quality[cite: 1].

We further enhance the framework with a **Confidence-Aware and QoE-Driven routing mechanism**[cite: 1]. High-confidence ML predictions drive dynamic path selection, while low-confidence predictions gracefully trigger QoE-based routing using metrics like throughput, delay, packet loss, jitter, PSNR, and SSIM[cite: 1].

---

## ⚙️ Methodology & Architecture
1. **Network Creation:** Virtual NSFNET topology built using **Mininet** with multiple alternative paths[cite: 1].
2. **SDN Controller:** **Floodlight** acts as the network brain, controlling switches via OpenFlow and REST APIs[cite: 1].
3. **Traffic Generation & Analysis:** **iperf3** generates traffic while tools like **NFStream** and **Ping** collect RTT, loss, throughput, and bandwidth stats[cite: 1].
4. **ML Model Training:** Datasets built from network statistics are evaluated across models like XGBoost, Random Forest, SVM, KNN, AdaBoost, and Logistic Regression[cite: 1]. 
5. **Dynamic Path Selection:** The algorithm evaluates the top-5 shortest candidate paths from Floodlight, predicts traffic levels, and updates flow tables dynamically[cite: 1].

---

## 🛠️ Technology Stack

### Core Backend & Network
| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Programming** | Python | Routing algorithm & automation[cite: 1] |
| **SDN Controller** | Floodlight | Controls switches via OpenFlow + REST API[cite: 1] |
| **Network Simulator** | Mininet | Creates the virtual NSFNET topology[cite: 1] |
| **ML Platform** | Google Colab | Machine learning model training[cite: 1] |
| **ML Model** | Logistic Regression | Traffic prediction[cite: 1] |
| **Traffic Generation** | iperf3 | Generates network traffic[cite: 1] |
| **Traffic Analysis** | Ping / NFStream | Collects network statistics[cite: 1] |
| **Video Tools** | PSNR, SSIM | Video transmission & quality evaluation[cite: 1] |
| **Operating System** | Ubuntu 20.04 | Development environment[cite: 1] |

### Proposed Frontend Technologies
| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Web UI Framework** | React.js / Vite + Tailwind CSS | Main frontend / web interface[cite: 1] |
| **Topology Visualizer** | Cytoscape.js | Visualizes network topology[cite: 1] |
| **Real-Time Analysis** | Chart.js | Displays latency, throughput, etc.[cite: 1] |

---

## 🚀 Proposed Enhancement: Confidence-Aware & QoE-Driven Routing
* **High Confidence ($\ge 90\%$):** Directly utilizes the ML-predicted best path for multimedia transmission[cite: 1].
* **Low Confidence ($< 90\%$):** Falls back to a robust **QoE-Based Path Selection** optimizing throughput, RTT/delay, packet loss, jitter, and bandwidth before updating the Floodlight flow tables[cite: 1].

---

## 🔄 Algorithm Design Flow
1. Initialize SDN / Mininet Network (Floodlight Controller)[cite: 1]
2. Define Source and Destination (Client & Server IP)[cite: 1]
3. Load Logistic Regression Model & Get Top-5 Shortest Candidate Paths[cite: 1]
4. Collect Path Statistics (RTT, Traffic, Bandwidth, Throughput, Packet Loss)[cite: 1]
5. **Model Evaluation:** Predict traffic level and confidence score[cite: 1]
6. **Decision Engine:** Route via ML prediction if confidence is high; otherwise, invoke QoE-based selection[cite: 1]
7. Update Flow Tables via Floodlight and execute periodic re-routing if network conditions shift[cite: 1]
