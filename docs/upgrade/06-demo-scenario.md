# Five-minute CasaMove demonstration

Use two independent browser contexts, such as a normal window and an incognito window. Use the existing passenger and admin demo accounts documented in the [project README](../../README.md#démarrage). When preparing demo data on a fresh isolated database, use the existing Compose seed. The live workshop database does not need reseeding.

1. Open `http://localhost:3000/fr` as the passenger. Show the line grid, the network status source and the schematic. Select the Casa Port ↔ Sidi Maarouf shortcut.
2. On the planner, select the first route. Confirm the T3 ride towards Hay Al Wahda and the walk from Bd Mohammed VI to BW1 Al Qods, then the ride towards Omar El Khayam. The standard estimate is 55 minutes excluding wait time.
3. Save the journey and select **Démarrer le trajet**. Leave progress at Casa Port for the demonstration so the verified alternate interchange remains ahead.
4. In the admin context open `http://localhost:3000/admin/mobility`. Create a **Segment fermé** simulation on T3 from **Dar Attouzani** to **Bd Mohammed VI** and publish its message. Use an obvious demonstration title.
5. Return to the passenger tab without refreshing. Wait for the next status poll. The alternative walks across Mohammed Smiha → Mohamed Diouri, rides T1 towards Lissasfa, and transfers at Laymoune → Omar El Khayam for Sidi Maarouf. Show the original and updated maps, then accept the reroute.
6. Open Community Pulse as the passenger and submit an observation at Dar Attouzani. In the tower, confirm the report and associate it with the simulated incident. In Mon espace show saved routes, the subscription card and the notification centre. Resolve the incident from the tower.
7. In a mobile viewport open the network, switch the browser offline after the service worker has activated, and reload. Open the cached planner and calculate a trip. Point out the offline traffic label.

For a no-alternative example, suspend **BW1** while a trip to Sidi Maarouf is active. Resolve the incident to restore availability. For the original route after accepting a reroute, open the plan again after resolving the simulation.
