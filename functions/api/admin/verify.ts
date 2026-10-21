import { Env, verifyAdminPassword } from '../_gateway';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    let password = '';
    try {
      const body: any = await request.json();
      password = body.password || '';
    } catch (_) {}

    const expectedPassword = env.ADMIN_PASSWORD;
    if (!expectedPassword) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ADMIN_PASSWORD が環境変数に設定されていません'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // ヘッダー（Authorization: Bearer / x-admin-password）またはボディのパスワードを照合
    const isAuthorized = verifyAdminPassword(request, env) || (password.trim() === expectedPassword);

    if (!isAuthorized) {
      return new Response(JSON.stringify({
        success: false,
        error: 'パスワードが正しくありません'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: '認証に成功しました'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message || '認証エラーが発生しました'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!verifyAdminPassword(request, env)) {
    return new Response(JSON.stringify({
      success: false,
      error: '認証されていません'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    message: '管理者認証OK'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};
