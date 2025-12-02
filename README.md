# Nova S Pro Drill controll

Webapp allowing use of Nova S Pro without the original app. Original app requires internet access to venor's servers.
Supports pre-programmed and custom  drills

Based on findings by https://github.com/smee/nova-s-custom-drills . Thank you!

## How to use
- open https://olanga.github.io/nova/  and press connect button
  
  or
  
- download the index.html file and open it locally or host it on your own server
  
Webapp supports only Chrome and Chromium type browsers

## Features
- Possible to use offline
- Possible to modify and save programmed drills
- Long-press the drill button to open the drill editor
- Shoot a single test ball from the drill editor (no save required to test) 
- Possible to set modified settings as a new default
- Programmed and custom drills are divided into 3 categories
- There are 4 themes including a dark mode
- Optional console log to trace events
- Length of drill can be set by time or number of repetitions
- Countdown to start and drill countdown 
- Ball sequence within a drill can be randomized in the drill editor
- Randomized drills are marked with a badge ‘R’
- Drill can be paused or stopped anytime
- Each ball in a custom drill can have many options (pseudorandomness)
- Accumulated counters (eg. Balls: 65 | Drills: 38)
- Possible to factory reset settings
- Factory reset removes all custom drills, resets counters and restores default drills
- All settings are stored in a browser's local storage

## Custom drills - additional info
- Custom drills can be defined in three groups: Custom A, B and C
- Each custom category can hold up to 20 drills
- Every custom drill can hold up to 20 balls
- Custom drills can be imported and exported as CSV file. See nova_custom_drills_example.csv
- Drills in custom category are created dynamically based on the data in the CSV file
- Ball options. Each ball can have many options which will be picked at random
- Alternative balls have the same ball number in the CSV file:

    `Set;Ball;Name;Top;Bottom;Height;Drop;Freq;Reps`
  
    `A;1;push 1;1000;1000;-40;6;0;1`

    `A;1;push 1;1000;1000;40;6;0;1`

## Ball parameters (as discovered by Smee)

- Top: speed upper wheel 400 <=x <= 7500 rpm (step size 1)
- Bot: speed lower wheel 400 <=x <= 7500 rpm (step size 1)
- Hgt: ball height -50 <=x <= 100 (step size 1) ; (down - up)
- Drp: drop point -10 <=x <= 10 (step size 0.5) ; (right to left)
- Frq: frequency 0 <=x <= 100 (step size 10) ; (0% = 30bpm = 2 sec pause) (100% = 90bpm = 0.67 sec pause) credit: plunder
- Rep: repetitions 1 <=x <= 200 (step size 1)

Remark: there is a room for improvement in this area. Not very user friendly








