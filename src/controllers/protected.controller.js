// Both handlers are three lines and neither mentions a token, a header or
// Supabase. That is the entire payoff of the middleware: by the time either runs,
// req.user is a user Supabase vouched for, and the route can get on with its
// actual job.

export const profile = (req, res) => {
  res.json({ user: req.user });
};

// The proof that the guard is reusable. This route was added without writing one
// new line of auth code — it rejects a bad token and admits a good one purely by
// having requireAuth in front of it in protected.routes.js.
export const dashboard = (req, res) => {
  res.json({
    message: `Welcome back, ${req.user.email}.`,
    user: req.user,
  });
};
