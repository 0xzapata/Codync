use super::*;

fn forty_lines(room: &Room, user_text: &str, mention_line: usize) -> Lane {
    let root = room
        .hub
        .store
        .insert_entry(
            &Lane::main(&room.group),
            EntryKind::Agent,
            1,
            &json!({"text": "Original proposal", "author": "a", "final": true}),
        )
        .unwrap();
    let lane = Lane::in_thread(&room.group, &root.id);
    for line in 1..=40 {
        let kind = if line == 1 { EntryKind::User } else { EntryKind::Agent };
        let text = if line == 1 {
            user_text.to_owned()
        } else if line == mention_line {
            format!("line {line}: @b review this")
        } else {
            format!("line {line}: progress")
        };
        room.hub.store.insert_entry(&lane, kind, 1, &json!({"text": text, "author": "a", "final": true})).unwrap();
    }
    lane
}

#[tokio::test]
async fn line_30_of_40_keeps_the_user_and_later_bot_mentions() {
    let room = Room::new();
    let lane = forty_lines(&room, "@a start the review", 30);
    let messages = since_last_user_message(&room.hub, &lane).unwrap();
    let roster = [bot("a", "a"), bot("b", "b")];
    let selected: Vec<_> = responders(&roster, &messages).iter().map(|b| b.id.clone()).collect();
    println!("INPUT: 40 thread messages; user @a on line 1; bot @b on line 30");
    println!("OUTPUT: read={} lines; responders={selected:?}", messages.len());
    room.shutdown().await;
    assert_eq!(selected, ["a", "b"]);
    assert_eq!(messages.len(), 40);
}

#[tokio::test]
async fn mention_before_the_last_24_lines_is_not_lost() {
    let room = Room::new();
    let lane = forty_lines(&room, "Please review", 10);
    let messages = since_last_user_message(&room.hub, &lane).unwrap();
    let roster = [bot("a", "a"), bot("b", "b")];
    let selected: Vec<_> = responders(&roster, &messages).iter().map(|b| b.id.clone()).collect();
    println!("INPUT: 40 thread messages; no user mention; bot @b on line 10");
    println!("OUTPUT: read={} lines; responders={selected:?}", messages.len());
    room.shutdown().await;
    assert_eq!(selected, ["b"]);
    assert_eq!(messages.len(), 40);
}

#[tokio::test]
async fn newer_user_message_resets_mentions_and_other_lanes_do_not_count() {
    let room = Room::new();
    let lane = forty_lines(&room, "@a start", 10);
    let new_user = room.hub.store.insert_entry(&lane, EntryKind::User, 2, &json!({"text": "Fresh request"})).unwrap();
    room.hub
        .store
        .insert_entry(&Lane::main(&room.group), EntryKind::User, 2, &json!({"text": "@all unrelated main message"}))
        .unwrap();
    let messages = since_last_user_message(&room.hub, &lane).unwrap();
    assert_eq!(messages.len(), 1);
    assert_eq!(messages[0].id, new_user.id);
    let roster = [bot("a", "a"), bot("b", "b")];
    assert_eq!(responders_in_thread(&roster, &messages, Some("a"))[0].id, "a");
    room.shutdown().await;
}

#[tokio::test]
async fn lane_without_a_user_message_keeps_all_available_mentions() {
    let room = Room::new();
    let lane = Lane::main(&room.group);
    for line in 1..=40 {
        room.hub
            .store
            .insert_entry(
                &lane,
                EntryKind::Agent,
                1,
                &json!({"text": if line == 10 { "@b review" } else { "progress" },
                "author": "a", "final": true}),
            )
            .unwrap();
    }
    let messages = since_last_user_message(&room.hub, &lane).unwrap();
    let roster = [bot("a", "a"), bot("b", "b")];
    let selected: Vec<_> = responders_in_thread(&roster, &messages, Some("a")).iter().map(|b| b.id.as_str()).collect();
    assert_eq!(messages.len(), 40);
    assert_eq!(selected, ["b"]);
    room.shutdown().await;
}

#[tokio::test]
async fn routing_cap_returns_an_error_instead_of_guessing() {
    let room = Room::new();
    let lane = Lane::main(&room.group);
    for _ in 0..MAX_ROUTING_LINES {
        room.hub
            .store
            .insert_entry(&lane, EntryKind::Agent, 1, &json!({"text": "progress", "author": "a", "final": true}))
            .unwrap();
    }
    let error = since_last_user_message(&room.hub, &lane).unwrap_err();
    assert!(error.to_string().contains("4096 lines without a user message"));
    room.shutdown().await;
}
