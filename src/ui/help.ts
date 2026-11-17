// Help text for the interface: what each tool and decision does.
//
// This is not story (the story lives in content/ as JSON); it is the wording of
// the controls, shared by the tooltips on the tool tray and the How to Play card.

export const TIPS: Record<string, string> = {
  Wrists: 'Have them pay by card and look. A person has faint blue veins, different on each wrist.',
  Reflection: 'Compare them with the mirror. A reflection keeps time and faces the way it should.',
  Shadow: 'Look at the floor. A person throws one soft shadow, and it stays under them.',
  'Small talk': 'Ask questions. Listen for borrowed words and towns that are not on the map. How you ask matters.',
  Serve: 'They get what they came for, and leave.',
  'Turn away': 'Send them back out into the fog.',
  Shelter: 'Put them in the back room for the night. Wren holds the only key.',
  Decide: 'This one is not a matter of fuel.',
};

export const HOW_TO_PLAY: string[] = [
  'A visitor walks in. Work out whether they are a person, then decide.',
  '',
  'FOUR CHECKS (each costs time, and patience)',
  '1  Wrists       faint blue veins, different on each wrist',
  '2  Reflection   keeps time with them, faces the right way',
  '3  Shadow       one soft shadow, staying under them',
  '4  Small talk   borrowed words, wrong towns, things they should not know',
  '',
  'THREE DECISIONS',
  'Q  Serve        they leave with what they came for',
  'W  Turn away    back into the fog',
  'E  Shelter      the back room, if Wren gives you the key',
  '',
  'Click Wren to ask what they think. Wren is not always right.',
  'Space or click: next line.   Hold Shift: fast-forward.   Esc: menu.',
];

export const WARNING: string[] = [
  'This is a horror game.',
  '',
  'It contains psychological horror, brief gore,',
  'flickering and flashing light, and sudden sounds.',
  '',
  'If flashing light is a problem for you, turn on',
  '"Softer flicker" in Settings before you start.',
];

export const CREDITS_TEXT: string[] = [
  'LAST SHIFT',
  '',
  'Design and story        Disath Wickrama',
  'Code, art and sound     generated in code; see docs/ARCHITECTURE.md',
  '',
  'No image, audio or font files are used.',
  'Every picture is drawn on a canvas and every',
  'sound is synthesised with the Web Audio API.',
  '',
  'Built with Vite and TypeScript.',
];
