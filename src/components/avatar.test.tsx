import { render, screen } from '@testing-library/react-native';

import { Avatar, initialsOf } from './avatar';

describe('initialsOf', () => {
  it('takes up to two initials from a name', () => {
    expect(initialsOf('Gaël Tikeng Lambou')).toBe('GT');
    expect(initialsOf('madeleine')).toBe('M');
  });
  it('falls back to the email local part, then to a placeholder', () => {
    expect(initialsOf('gael@nyota.ltd')).toBe('GN');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});

describe('Avatar', () => {
  it('shows initials when there is no picture', async () => {
    await render(<Avatar name="Gaël Tikeng" />);
    expect(screen.getByText('GT')).toBeOnTheScreen();
  });
  it('shows the picture when there is one', async () => {
    await render(<Avatar uri="https://img.test/a.jpg" name="Gaël" />);
    expect(screen.getByLabelText("Gaël's photo")).toBeOnTheScreen();
    expect(screen.queryByText('G')).toBeNull();
  });
});
