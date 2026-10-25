/** Each timed effect is independent. New kinds can add their own settings here. */
export interface ScreenShrinkEvent {
  id: string;
  kind: 'screen-shrink';
  at: number;
  warning: number;
  contract: number;
  hold: number;
  recover: number;
  inset: number;
  scale: number;
}

export type GimmickEvent = ScreenShrinkEvent;

export function gimmickDuration(event: GimmickEvent): number {
  switch (event.kind) {
    case 'screen-shrink': return event.warning + event.contract + event.hold + event.recover;
  }
}
