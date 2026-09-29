# Product decisions

## Audience and tone

Start with home-cook enthusiasts who want to explore and grow their 拿手菜, share food, and reflect on what works. Professional restaurant workflows are deferred. The current platform is a responsive web app; native iOS was discussed but is not implemented.

有家 should feel calm, Taiwanese vintage, warm, personal, and familiar. Guests should see a human cook's food and real notes/replies. AI identity and chef-authored statements stay distinct.

## Chef experience

Today is the main screen. A cook can start with an unfinished idea, market photo, pantry observation, existing recipe, or post-cooking reflection. No mandatory logging/brainstorming stages or assigned lessons. The assistant follows the cook's train of thought while preserving coherent artifacts.

Discussion cards can resume later. A small 稿 icon opens 料理草稿; blank is a valid state. Claims distinguish user statements, model inference, actual cook records, guest feedback, and external sources. The cook explicitly saves ideas/recipe versions and sets maturity. Search happens when requested, and photos are tentative observations.

My Kitchen groups 想試的, 有信心的, 分享過的. 我煮了 records an actual cook and reflection. The cook wants a short useful order sheet and freedom to improvise, not constant portion/inventory confirmation prompts.

## Guest experience

Opening: 「小林說，你可能會喜歡來有家吃飯。」 This is demo copy, not a verified referral identity. Two entrances: 幫我想想吃什麼 and 看看這週煮什麼.

The assistant should offer a useful meal after one or two exchanges when possible. Talkative guests can continue, with a gentle return to food. Avoid therapy, excessive questions, and conspicuous memory displays. Only offer dishes the cook has published; surprise cannot create an execution promise the cook never approved.

Before reservation, explicitly collect name, portions, dietary restrictions (or 無), and an optional note. Every request waits for chef confirmation. AI cannot send messages in Sam's voice or claim an order has been placed through conversation alone.

在有家吃過的 holds a meal, optional photo and honest feedback, plus actual chef replies. Feedback should feel like leaving a note to the cook. It links to recipe history, but does not automatically rewrite the recipe or permanent guest preferences.

## Deferred ideas

- 有家超市: ingredient browsing and flavor selection.
- Inventory and weekly stale-item reminders, purchasing/budget support. Consumption only on the cook's explicit report; transformed leftovers are distinct items.
- Background feasibility planner for procurement, time, cost, and reasonable approved variations.
- Native iOS, cloud sync, multiple chefs, public referral enforcement, fulfillment and payments.
- Broader personalized memory and surprise/pairing sophistication.
- Full artifact export UI: ownership and inspectability are accepted principles, implementation is incomplete.
