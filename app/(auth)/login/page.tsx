import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <section className="login-card">
        <h1>Internal Task Management</h1>
        <p className="muted">Masuk menggunakan akun yang telah didaftarkan oleh administrator.</p>
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
        <form action={login} className="form section">
          <div className="field"><label>Email</label><input name="email" type="email" required /></div>
          <div className="field"><label>Password</label><input name="password" type="password" required /></div>
          <button className="btn" type="submit">Masuk</button>
        </form>
      </section>
    </main>
  );
}
