# Nova S Pro Drill Control 2.0

A pretty web client for the Nova S Pro table tennis robot. This tool replaces the original app, removing the requirement for server connectivity.

## Usage

**Online:**

  * Visit: [https://olanga.github.io/nova/](https://olanga.github.io/nova/)

**Local:**

  * Download repository files and host locally (e.g., `python3 -m http.server`).

**Requirements:**

  * Chrome or Chromium-based browser.

## Features

**General**

  * **Offline Capable:** Works entirely without internet access.
  * **Data Persistence:** Settings and drills saved to browser local storage.
  * **Themes:** 4 options, including dark mode.
  * **Stratistics:**  accumulated counters (total balls/drills).<br>


**Drill Management**

  * **Edit & Create:** Modify pre-programmed drills or create custom ones (Groups A, B, C).
  * **Sharing:** Import/export via CSV or share online specific drills using codes.
  * **Randomization:** Randomize ball sequences or enable random options per ball.
  * **Randomization:** (RND) Randomize single ball in a range (-drop point to +drop point)
  * **Controls:** Set drill duration (time or repetitions), pause/stop, and countdown timers.<br>


**Editor Tools**

  * **Drill Editor:** Long-press drill button to access. Supports deletion, "save as", and testing entire sequences.
  * **Ball Editor:** Add/remove balls, adjust sequence, rename drills, and test single balls without saving.

## Custom Drills (CSV)

Drills can be imported via CSV. Each category (A, B, C) holds 20 drills; each drill holds 20 balls. Alternative balls (pseudo-randomness) share the same ball number.

**CSV Format:** `Set;Ball;Name;Speed;Spin;Type;Height;Drop;Freq;Reps`

**Example:**

```csv
A;1;Drill A2;7.5;5;top;50;-5;10;1
A;2;Drill A2;7.5;5;back;50;-5;10;1
B;1;Drill B1;7.5;5;top;50;-5;10;1
B;1;Drill B1;7.5;5;back;50;5;10;1
```

## Technical Parameters

| Parameter | Description | Range | Step |
| :--- | :--- | :--- | :--- |
| **Spin type** |top/back | - | - |
| **Speed** | ball speed | 0 - 10 | 0.5 |
| **Spin** | ball spin | 0 - 10 | 0.5 |
| **Height** | Ball height | -50 (down) to 100 (up) | 1 |
| **Drop** | Drop point | -10 (right) to 10 (left) | 0.5 |
| **Freq** | Frequency | 0 - 100 | 10 |
| **Reps** | Repetitions | 1 - 200 | 1 |

*Note: 0% Freq = \~30bpm; 100% Freq = \~90bpm.*

## Credits & Support

Additional informations: [Wiki](https://github.com/olanga/nova/wiki/Protocol-Overview)

Based on findings by [smee](https://github.com/smee/nova-s-custom-drills) and plunder.

RPM version 1.3: [https://olanga.github.io/nova/1.3](https://olanga.github.io/nova/1.3)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/E1E21PUFEQ)



