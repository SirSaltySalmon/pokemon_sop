import type { SupabaseClient } from "@supabase/supabase-js";

export async function getRandomCharacter(
  supabase: SupabaseClient,
  query: { tags?: string; exclude?: string; excludeIds?: string }
) {
  const { tags, exclude, excludeIds } = query;
  let eligibleCharIds: number[] | null = null;

  if (tags) {
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tagList.length > 0) {
      const { data: tagData, error: tagError } = await supabase
        .from("tags")
        .select("id")
        .in("name", tagList);
      if (tagError) throw tagError;
      if (tagData?.length) {
        const tagIds = tagData.map((t) => t.id);
        const { data: charTagData, error: charTagError } = await supabase
          .from("character_tags")
          .select("character_id")
          .in("tag_id", tagIds);
        if (charTagError) throw charTagError;
        if (charTagData?.length) {
          eligibleCharIds = [...new Set(charTagData.map((ct) => ct.character_id))];
        } else {
          return { error: "No character found" as const, status: 404 };
        }
      } else {
        return { error: "No character found" as const, status: 404 };
      }
    }
  }

  if (exclude) {
    const excludeList = exclude
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (excludeList.length > 0) {
      const { data: excludeTagData, error: excludeTagError } = await supabase
        .from("tags")
        .select("id")
        .in("name", excludeList);
      if (excludeTagError) throw excludeTagError;
      if (excludeTagData?.length) {
        const excludeTagIds = excludeTagData.map((t) => t.id);
        const { data: excludeCharTagData, error: excludeCharTagError } =
          await supabase
            .from("character_tags")
            .select("character_id")
            .in("tag_id", excludeTagIds);
        if (excludeCharTagError) throw excludeCharTagError;
        if (excludeCharTagData?.length) {
          const excludedCharIds = [
            ...new Set(excludeCharTagData.map((ct) => ct.character_id)),
          ];
          if (eligibleCharIds) {
            eligibleCharIds = eligibleCharIds.filter(
              (id) => !excludedCharIds.includes(id)
            );
          } else {
            const { data: allChars, error: allCharsError } = await supabase
              .from("characters")
              .select("id");
            if (allCharsError) throw allCharsError;
            eligibleCharIds = allChars
              ? allChars.map((c) => c.id).filter((id) => !excludedCharIds.includes(id))
              : [];
          }
        }
      }
    }
  }

  if (excludeIds) {
    const ids = excludeIds
      .split(",")
      .map((id) => parseInt(id, 10))
      .filter((id) => !Number.isNaN(id));
    if (ids.length > 0) {
      if (eligibleCharIds) {
        eligibleCharIds = eligibleCharIds.filter((id) => !ids.includes(id));
      } else {
        const { data: allChars, error: allCharsError } = await supabase
          .from("characters")
          .select("id");
        if (allCharsError) throw allCharsError;
        eligibleCharIds = allChars
          ? allChars.map((c) => c.id).filter((id) => !ids.includes(id))
          : [];
      }
    }
  }

  if (!eligibleCharIds) {
    const { data: allChars, error: allCharsError } = await supabase
      .from("characters")
      .select("id");
    if (allCharsError) throw allCharsError;
    eligibleCharIds = allChars ? allChars.map((c) => c.id) : [];
  }

  if (eligibleCharIds.length === 0) {
    return { error: "No character found" as const, status: 404 };
  }

  const randomIndex = Math.floor(Math.random() * eligibleCharIds.length);
  const characterId = eligibleCharIds[randomIndex];

  const { data: character, error: charError } = await supabase
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .single();
  if (charError) throw charError;
  if (!character) {
    return { error: "Character not found" as const, status: 404 };
  }

  const { data: tagRows, error: tagRowsError } = await supabase
    .from("character_tags")
    .select("tag_id")
    .eq("character_id", character.id);
  if (tagRowsError) throw tagRowsError;

  let tagNames: string[] = [];
  if (tagRows?.length) {
    const tagIds = tagRows.map((tr) => tr.tag_id);
    const { data: tagsData, error: tagsError } = await supabase
      .from("tags")
      .select("name")
      .in("id", tagIds);
    if (tagsError) throw tagsError;
    tagNames = tagsData ? tagsData.map((t) => t.name) : [];
  }

  return { character: { ...character, tags: tagNames } };
}

export async function postVote(
  supabase: SupabaseClient,
  characterId: number,
  sessionId: string,
  voteType: boolean
) {
  const { data: statsData, error: statsError } = await supabase
    .from("user_interactions")
    .select("vote_type")
    .eq("character_id", characterId)
    .not("vote_type", "is", null);
  if (statsError) throw statsError;

  const yesVotes = statsData?.filter((s) => s.vote_type === true).length ?? 0;
  const noVotes = statsData?.filter((s) => s.vote_type === false).length ?? 0;
  const totalVotes = yesVotes + noVotes + 1;
  const newYesVotes = voteType ? yesVotes + 1 : yesVotes;
  const newNoVotes = voteType ? noVotes : noVotes + 1;

  const { error: insertError } = await supabase.from("user_interactions").insert({
    character_id: characterId,
    session_id: sessionId,
    action_type: "vote",
    vote_type: voteType,
  });
  if (insertError) throw insertError;

  return {
    success: true as const,
    characterId,
    voteType,
    totalVotes,
    newYesVotes,
    newNoVotes,
  };
}

export async function postSkip(
  supabase: SupabaseClient,
  characterId: number,
  sessionId: string
) {
  const { error } = await supabase.from("user_interactions").insert({
    character_id: characterId,
    session_id: sessionId,
    action_type: "skip",
    vote_type: null,
  });
  if (error) throw error;
  return { success: true as const, characterId };
}

export async function getCharacterResults(
  supabase: SupabaseClient,
  characterId: number
) {
  const { data: character, error: charError } = await supabase
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .single();
  if (charError) throw charError;
  if (!character) {
    return { error: "Character not found" as const, status: 404 };
  }

  const { data: statsData, error: statsError } = await supabase
    .from("user_interactions")
    .select("vote_type")
    .eq("character_id", characterId)
    .not("vote_type", "is", null);
  if (statsError) throw statsError;

  const totalVotes = statsData?.length ?? 0;
  const yesVotes =
    statsData?.filter((s) => s.vote_type === true).length ?? 0;
  const noVotes =
    statsData?.filter((s) => s.vote_type === false).length ?? 0;

  return {
    character,
    voteStats: { totalVotes, yesVotes, noVotes },
  };
}
