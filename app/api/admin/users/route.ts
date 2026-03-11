import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CreateUserBody = {
  fullName?: string;
  displayName?: string;
  email?: string;
  password?: string;
  role?: "admin" | "manager" | "sales" | "viewer";
};

type DeleteUserBody = {
  userId?: string;
};

type UpdateUserRoleBody = {
  userId?: string;
  role?: "admin" | "manager" | "sales" | "viewer";
};

async function buildAdminClients(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return { ok: false as const, status: 500, message: "Ambiente do Supabase nao configurado." };
  }

  const accessToken = request.cookies.get("crm_access_token")?.value;

  if (!accessToken) {
    return { ok: false as const, status: 401, message: "Sessao invalida." };
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
    return { ok: false as const, status: 401, message: "Sessao expirada. Entre novamente." };
  }

  const { data: adminProfile, error: adminProfileError } = await serviceClient
    .from("profiles")
    .select("organization_id, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (adminProfileError || !adminProfile?.organization_id) {
    return { ok: false as const, status: 403, message: "Nao foi possivel validar o perfil atual." };
  }

  if (adminProfile.role !== "admin") {
    return { ok: false as const, status: 403, message: "Apenas administradores podem gerenciar usuarios da equipe." };
  }

  return {
    ok: true as const,
    authClient,
    serviceClient,
    currentUser,
    adminProfile
  };
}

export async function GET(request: NextRequest) {
  const adminContext = await buildAdminClients(request);

  if (!adminContext.ok) {
    return NextResponse.json({ ok: false, message: adminContext.message }, { status: adminContext.status });
  }

  const { serviceClient, adminProfile } = adminContext;

  const { data: profiles, error: profilesError } = await serviceClient
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", adminProfile.organization_id)
    .order("created_at", { ascending: false });

  if (profilesError || !profiles) {
    return NextResponse.json({ ok: false, message: "Nao foi possivel listar usuarios da equipe." }, { status: 400 });
  }

  const { data: usersPage, error: usersError } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (usersError || !usersPage?.users) {
    return NextResponse.json({ ok: false, message: "Nao foi possivel carregar os dados de login dos usuarios." }, { status: 400 });
  }

  const emailById = new Map<string, string>();
  usersPage.users.forEach((user) => {
    emailById.set(user.id, user.email ?? "");
  });

  return NextResponse.json({
    ok: true,
    users: profiles.map((profile) => ({
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      createdAt: profile.created_at,
      email: emailById.get(profile.id) ?? ""
    }))
  });
}

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

  if (!["admin", "manager", "sales", "viewer"].includes(role)) {
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

export async function DELETE(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Configure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY para excluir usuarios internos."
      },
      { status: 500 }
    );
  }

  const accessToken = request.cookies.get("crm_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ ok: false, message: "Sessao invalida." }, { status: 401 });
  }

  const body = (await request.json()) as DeleteUserBody;
  const userId = body.userId?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ ok: false, message: "Informe o usuario a ser excluido." }, { status: 400 });
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

  if (currentUser.id === userId) {
    return NextResponse.json(
      { ok: false, message: "Nao e permitido excluir o proprio usuario administrador por esta rota." },
      { status: 400 }
    );
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
      { ok: false, message: "Apenas administradores podem excluir usuarios da equipe." },
      { status: 403 }
    );
  }

  const { data: targetProfile, error: targetProfileError } = await serviceClient
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfileError || !targetProfile) {
    return NextResponse.json({ ok: false, message: "Usuario nao encontrado." }, { status: 404 });
  }

  if (targetProfile.organization_id !== adminProfile.organization_id) {
    return NextResponse.json(
      { ok: false, message: "Nao e permitido excluir usuarios de outra organizacao." },
      { status: 403 }
    );
  }

  const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(userId);

  if (deleteUserError) {
    return NextResponse.json(
      {
        ok: false,
        message: deleteUserError.message || "Nao foi possivel excluir o usuario."
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Usuario excluido com seus registros vinculados."
  });
}

export async function PATCH(request: NextRequest) {
  const adminContext = await buildAdminClients(request);

  if (!adminContext.ok) {
    return NextResponse.json({ ok: false, message: adminContext.message }, { status: adminContext.status });
  }

  const { serviceClient, adminProfile, currentUser } = adminContext;
  const body = (await request.json()) as UpdateUserRoleBody;
  const userId = body.userId?.trim() ?? "";
  const role = body.role ?? "sales";

  if (!userId) {
    return NextResponse.json({ ok: false, message: "Informe o usuario a ser atualizado." }, { status: 400 });
  }

  if (!["admin", "manager", "sales", "viewer"].includes(role)) {
    return NextResponse.json({ ok: false, message: "Papel invalido." }, { status: 400 });
  }

  if (userId === currentUser.id && role !== "admin") {
    return NextResponse.json(
      { ok: false, message: "Nao e permitido remover o proprio acesso de administrador por esta rota." },
      { status: 400 }
    );
  }

  const { data: targetProfile, error: targetProfileError } = await serviceClient
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfileError || !targetProfile) {
    return NextResponse.json({ ok: false, message: "Usuario nao encontrado." }, { status: 404 });
  }

  if (targetProfile.organization_id !== adminProfile.organization_id) {
    return NextResponse.json(
      { ok: false, message: "Nao e permitido alterar usuarios de outra organizacao." },
      { status: 403 }
    );
  }

  const { error: updateError } = await serviceClient.from("profiles").update({ role }).eq("id", userId);

  if (updateError) {
    return NextResponse.json(
      { ok: false, message: updateError.message || "Nao foi possivel atualizar o papel do usuario." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, message: "Papel do usuario atualizado." });
}
