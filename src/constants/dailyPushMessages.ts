/**
 * Louis Murray / Nevermore Phase 2 daily push sequence (days 1–40).
 * Sourced from client deck "Nevermore Optimization Phase 2" (Nov 2026).
 * Do not add alcohol, addiction, relapse, or recovery in notification copy.
 */
export type DailyPushMessage = {
  day: number;
  title: string;
  body: string;
};

export const DAILY_PUSH_MESSAGES: readonly DailyPushMessage[] = [
  { day: 1, title: 'A little nudge.', body: 'Nevermore is here when you’re ready.' },
  { day: 2, title: 'I knew you’d be back.', body: 'Or at least I was hoping you would be.' },
  { day: 3, title: 'Bored? Good.', body: 'Your brain is probably about to invent some bullshit. Stay awake to it.' },
  { day: 4, title: 'No clocks. No pressure.', body: 'Move at your pace. Your truth isn’t on a timer.' },
  { day: 5, title: 'Anxiety is a bitch.', body: 'But it doesn’t get to write the next chapter for you.' },
  { day: 6, title: 'Still you.', body: 'Whatever you’re working through, don’t lose yourself in the process.' },
  { day: 7, title: 'Quiet still counts.', body: 'Not every meaningful moment has to feel dramatic.' },
  { day: 8, title: 'Your fight. Your rules.', body: 'Nobody else gets to define what matters to you.' },
  { day: 9, title: 'Take inventory.', body: 'Sometimes what’s still on the table matters more than what’s already gone.' },
  { day: 10, title: 'Something influencing you?', body: 'Notice it before it starts making decisions for you.' },
  { day: 11, title: 'Don’t forget your people.', body: 'Sometimes one honest conversation changes everything.' },
  { day: 12, title: 'Truth isn’t punishment.', body: 'Sometimes the truth actually gives something back.' },
  { day: 13, title: 'Talent doesn’t make anyone bulletproof.', body: 'Neither does money, intelligence, or having your shit together.' },
  { day: 14, title: 'Still yours.', body: 'Pause. Leave. Come back. Nothing here owns you.' },
  { day: 15, title: 'You don’t owe an explanation.', body: 'Other people’s discomfort does not automatically become your problem.' },
  { day: 16, title: 'You’re allowed to disagree with me.', body: 'That might actually mean this thing is working.' },
  { day: 17, title: 'Nothing got erased.', body: 'A bad moment doesn’t delete everything that came before it.' },
  { day: 18, title: 'Quoth the Raven…', body: 'Yeah, you already know the rest.' },
  { day: 19, title: 'Check your life chips.', body: 'There may be more left on the table than your mind is telling you.' },
  { day: 20, title: 'Quiet can feel weird.', body: 'That doesn’t mean something is missing.' },
  { day: 21, title: 'What’s your real intention?', body: 'Not the respectable answer. The honest one.' },
  { day: 22, title: 'Who framed this shit anyway?', body: 'You’re allowed to question the story you were handed.' },
  { day: 23, title: 'Pride is sneaky.', body: 'Sometimes strength looks a lot like asking someone for help.' },
  { day: 24, title: 'Your body doesn’t care about philosophy.', body: 'If it’s telling you something important, listen.' },
  { day: 25, title: 'Pressure shared is pressure weakened.', body: 'You don’t have to carry every damn thing alone.' },
  { day: 26, title: 'Go be yourself today.', body: 'Seriously. Stop making everything a project.' },
  { day: 27, title: 'Welcome back.', body: 'No guilt trip. No lecture. Just welcome back.' },
  { day: 28, title: 'Tell yourself the truth.', body: 'Quiet lies are still lies.' },
  { day: 29, title: 'Timing matters.', body: 'Strategy and procrastination are not always the same thing.' },
  { day: 30, title: 'Sometimes it’s the fucking weather.', body: 'Tiny things can move us more than we realize.' },
  { day: 31, title: 'Shit happens.', body: 'You still get to decide what happens next.' },
  { day: 32, title: 'Your mind can lie about loneliness.', body: 'That doesn’t mean you’re actually alone.' },
  { day: 33, title: 'The future isn’t a verdict.', body: 'You’re imagining it, not remembering it.' },
  { day: 34, title: 'Be a beacon, not a billboard.', body: 'Live what you know. You don’t have to preach it.' },
  { day: 35, title: 'Not everything fits a neat little box.', body: 'Good. Neither do you.' },
  { day: 36, title: 'Raven or dove?', body: 'Darkness can teach you something without becoming where you live.' },
  { day: 37, title: 'You’re allowed to outgrow yesterday’s answers.', body: 'That’s not failure. That’s movement.' },
  { day: 38, title: 'You don’t need Nevermore forever.', body: 'That was never the point.' },
  { day: 39, title: 'Take the pen.', body: 'Nobody else gets to narrate your life from here.' },
  { day: 40, title: 'Nevermore.', body: 'Keep your truth. Keep your identity. Keep moving.' },
] as const;

export const DAILY_PUSH_COUNT = DAILY_PUSH_MESSAGES.length;