import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateUserBody = {
  fullName?: string;
  displayName?: string;
  email?: string;
  password?: string;
  role?: "admin" | "manager" | "sales";
};

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY para criar usuarios internos."
      },
      { status: 500 }
    );
  }

  const accessToken = request.cookies.get("crm_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Sessao invalida." }, { status: 401 });
  }

  const body = (await request.json()) as CreateUserBody;
  const fullName = body.fullName?.trim() ?? "";
  const displayName = body.displayName?.trim() || fullName;
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const role = body.role ?? "sales";

  if (!fullName || !email || !password) {
    return NextResponse.json({ ok: false, message: "Preencha nome, e-mail e senha." }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, message: "A senha precisa ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  if (!["admin", "manager", "sales"].includes(role)) {
    return NextResponse.json({ ok: false, message: "Papel invalido." }, { status: 400 });
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
    data: { user: currentUser },
    error: currentUserError
  } = await authClient.auth.getUser(accessToken);

  if (currentUserError || !currentUser) {
    return NextResponse.json({ ok: false, message: "Sessao expirada. Entre novamente." }, { status: 401 });
  }

  const { data: adminProfile, error: adminProfileError } = await serviceClient
    .from("profiles")
    .select("organization_id, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (adminProfileError || !adminProfile?.organization_id) {
    return NextResponse.json(
      { ok: false, message: "Nao foi possivel validar o perfil atual." },
      { status: 403 }
    );
  }

  if (adminProfile.role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "Apenas administradores podem cadastrar usuarios da equipe." },
      { status: 403 }
    );
  }

  const { data: organization } = await serviceClient
    .from("organizations")
    .select("name")
    .eq("id", adminProfile.organization_id)
    .maybeSingle();

  const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      display_name: displayName,
      organization_id: adminProfile.organization_id,
      organization_name: organization?.name ?? "CRM comercial",
      company_name: organization?.name ?? "CRM comercial",
      role
    }
  });

  if (createUserError || !createdUser.user) {
    return NextResponse.json(
      {
        ok: false,
        message: createUserError?.message || "Nao foi possivel criar o usuario."
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Usuario criado e vinculado a organizacao atual.",
    userId: createdUser.user.id
  });
}
