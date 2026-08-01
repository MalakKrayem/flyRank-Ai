// The lobby. It exists to be the control in the experiment: when /protected
// answers 401 you want one route you are certain is reachable, so you can tell
// "my token is wrong" apart from "my server is down".

export const info = (req, res) => {
  res.json({ message: 'Welcome stranger! This info is public.' });
};
