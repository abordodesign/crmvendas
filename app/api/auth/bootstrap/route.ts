import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY."
      },
      { status: 500 }
    );
  }

  const accessToken = request.cookies.get("crm_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Sessao invalida." }, { status: 401 });
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const {
    data: { user },
    error: userError
  } = await authClient.auth.getUser(accessToken);

  if (userError || !user) {
    return NextResponse.json({ ok: false, message: "Sessao expirada. Entre novamente." }, { status: 401 });
  }

  const { error } = await serviceClient.rpc("bootstrap_auth_user", {
    p_user_id: user.id,
    p_email: user.email ?? "",
    p_raw_user_meta_data: user.user_metadata ?? {}
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message || "Nao foi possivel inicializar o perfil." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
