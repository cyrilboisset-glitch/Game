// Construit public/assets/ual.glb à partir de la bibliothèque d'animations universelle de Quaternius (CC0) :
// ne garde que les animations utilisées par le jeu, compacte et écrit un .glb.
// Usage : NODE_PATH=<node_modules avec @gltf-transform/core et /functions> node tools/build-anims.mjs <dossier glTF de la bibliothèque>
import { NodeIO } from '@gltf-transform/core';
import { prune, resample, dedup } from '@gltf-transform/functions';
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Punch_Jab', 'Punch_Cross', 'Sword_Attack', 'Pistol_Idle_Loop', 'Pistol_Aim_Neutral', 'Pistol_Shoot',
  'Hit_Chest', 'Hit_Head', 'Death01', 'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Exit', 'Sitting_Talking_Loop', 'Driving_Loop', 'Fixing_Kneeling', 'Interact', 'PickUp_Table', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Roll', 'Idle_Talking_Loop', 'Push_Loop'];
const dir = process.argv[2]; const io = new NodeIO(); const doc = await io.read(`${dir}/AnimationLibrary_Godot_Standard.gltf`);
for (const a of doc.getRoot().listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
await doc.transform(resample({ tolerance: 1e-4 }), dedup(), prune());
await io.write('public/assets/ual.glb', doc);
console.log('animations :', doc.getRoot().listAnimations().map(a => a.getName()).join(', '));
