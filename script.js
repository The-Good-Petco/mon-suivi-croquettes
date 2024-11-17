let chart = null;
let measurements = JSON.parse(localStorage.getItem("catFood")) || [];

// Mode sombre
if (
  localStorage.theme === "dark" ||
  (!("theme" in localStorage) &&
    window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

function toggleDarkMode() {
  if (document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.remove("dark");
    localStorage.theme = "light";
  } else {
    document.documentElement.classList.add("dark");
    localStorage.theme = "dark";
  }
  updateChart();
}

// Fonctions utilitaires
function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

// Modifier la fonction saveMeasurements
function saveMeasurements() {
  try {
    localStorage.setItem("catFood", JSON.stringify(measurements));
  } catch (error) {
    // Gestion des erreurs si le localStorage est plein
    console.error("Erreur lors de la sauvegarde :", error);
    alert(
      "Erreur lors de la sauvegarde des données. L'espace de stockage est peut-être plein."
    );
  }
}

// Fonction pour calculer la consommation horaire entre deux mesures
function calculateHourlyConsumption(startDate, endDate, totalConsumption) {
  const hours = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);

  // Calcul du nombre total d'heures
  const totalHours = Math.max(1, (end - currentDate) / (1000 * 60 * 60));
  const consumptionPerHour = totalConsumption / totalHours;

  // Génération des heures avec leur consommation
  while (currentDate < end) {
    const hourData = {
      timestamp: new Date(currentDate),
      consumption: consumptionPerHour,
    };
    hours.push(hourData);
    currentDate.setHours(currentDate.getHours() + 1);
  }

  return hours;
}

// Fonction pour recalculer toutes les consommations
function recalculateConsumptions() {
  const sortedMeasurements = [...measurements].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Réinitialiser les consommations horaires
  let allHourlyConsumptions = [];

  for (let i = 0; i < sortedMeasurements.length; i++) {
    const current = sortedMeasurements[i];
    const previous = i > 0 ? sortedMeasurements[i - 1] : null;

    if (!previous) {
      current.consumed = 0;
      continue;
    }

    // Calcul de la consommation totale
    const theoreticalConsumption = previous.total - current.remaining;

    if (theoreticalConsumption < 0 || theoreticalConsumption > previous.total) {
      console.warn(
        `Anomalie détectée entre ${previous.timestamp} et ${current.timestamp}`
      );
      current.consumed = 0;
    } else {
      current.consumed = theoreticalConsumption;
      // Calcul et stockage des consommations horaires
      const hourlyConsumptions = calculateHourlyConsumption(
        previous.timestamp,
        current.timestamp,
        theoreticalConsumption
      );
      allHourlyConsumptions = [...allHourlyConsumptions, ...hourlyConsumptions];
    }
  }

  // Stocker les données triées par date décroissante
  measurements = sortedMeasurements.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  saveMeasurements();
  return allHourlyConsumptions;
}

// Fonction pour calculer la tendance
function calculateTrend() {
  const dailyData = getDailyConsumption();
  const dates = Object.keys(dailyData).sort();

  if (dates.length < 10) {
    // Besoin d'au moins 10 jours de données
    return {
      trend: 0,
      explanation: "Pas assez de données pour calculer une tendance",
    };
  }

  // Calcul des moyennes
  const last3Days = dates.slice(-3);
  const previous7Days = dates.slice(-10, -3);

  const recentAvg =
    last3Days.reduce((sum, date) => sum + dailyData[date], 0) / 3;
  const previousAvg =
    previous7Days.reduce((sum, date) => sum + dailyData[date], 0) / 7;

  // Calcul de la variation en pourcentage
  const variation = ((recentAvg - previousAvg) / previousAvg) * 100;

  // Définition des seuils pour les chats
  // Les chats sont sensibles aux changements, donc on considère des variations de 20%
  let explanation;
  if (Math.abs(variation) < 10) {
    explanation = "Consommation stable";
  } else {
    if (variation > 20) {
      explanation = "Augmentation significative de l'appétit";
    } else if (variation > 10) {
      explanation = "Légère augmentation de l'appétit";
    } else if (variation < -20) {
      explanation = "Diminution significative de l'appétit";
    } else {
      explanation = "Légère diminution de l'appétit";
    }
  }

  // Ajouter des conseils selon la tendance
  if (variation > 20) {
    explanation += "\nConseil : Surveillez le poids de votre chat";
  } else if (variation < -20) {
    explanation += "\nConseil : Vérifiez le comportement de votre chat";
  }

  return {
    trend: variation,
    explanation,
  };
}

// Mettre à jour l'affichage de la tendance
function updateTrend() {
  const { trend, explanation } = calculateTrend();
  const trendValue = document.getElementById("trend-value");
  const trendIcon = document.getElementById("trend-icon");
  const trendExplanation = document.getElementById("trend-explanation");

  if (trend === 0) {
    trendValue.textContent = "--";
    trendIcon.innerHTML = "";
  } else {
    trendValue.textContent = `${Math.abs(trend).toFixed(1)}%`;

    // Icône selon la tendance
    if (Math.abs(trend) < 10) {
      trendIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/>
                </svg>`;
    } else if (trend > 0) {
      trendIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                </svg>`;
    } else {
      trendIcon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/>
                </svg>`;
    }
  }

  trendExplanation.textContent = explanation;

  // Ajout de classes de couleur selon la tendance
  const baseClasses = "text-2xl font-bold";
  if (Math.abs(trend) < 10) {
    trendValue.className = `${baseClasses} text-gray-600 dark:text-gray-400`;
  } else if (trend > 20) {
    trendValue.className = `${baseClasses} text-red-600 dark:text-red-400`;
  } else if (trend < -20) {
    trendValue.className = `${baseClasses} text-blue-600 dark:text-blue-400`;
  } else {
    trendValue.className = `${baseClasses} text-yellow-600 dark:text-yellow-400`;
  }
}

// Fonction pour obtenir la consommation par jour
function getDailyConsumption() {
  const hourlyConsumptions = recalculateConsumptions();
  const dailyData = {};

  hourlyConsumptions.forEach((hourData) => {
    const dateKey = getDateKey(hourData.timestamp);
    dailyData[dateKey] = (dailyData[dateKey] || 0) + hourData.consumption;
  });

  // Arrondir les valeurs
  Object.keys(dailyData).forEach((key) => {
    dailyData[key] = Math.round(dailyData[key] * 10) / 10;
  });

  return dailyData;
}

// Mise à jour des statistiques
function updateStats() {
  const dailyData = getDailyConsumption();
  const today = getDateKey(new Date());
  const todayConsumption = dailyData[today] || 0;

  const dates = Object.keys(dailyData).sort();
  const last7Days = dates.slice(-7);
  const weekAvg =
    last7Days.length > 0
      ? last7Days.reduce((sum, date) => sum + dailyData[date], 0) /
        last7Days.length
      : 0;

  const currentMonth = new Date().getMonth();
  const monthTotal = dates
    .filter((date) => new Date(date).getMonth() === currentMonth)
    .reduce((sum, date) => sum + dailyData[date], 0);

  document.getElementById(
    "today-consumption"
  ).textContent = `${todayConsumption.toFixed(1)}g`;
  document.getElementById("week-average").textContent = `${weekAvg.toFixed(
    1
  )}g`;
  document.getElementById("month-total").textContent = `${monthTotal.toFixed(
    1
  )}g`;

  // Ajout de la mise à jour de la tendance
  updateTrend();
}

// Mise à jour du graphique
function updateChart() {
  const dailyData = getDailyConsumption();
  const dates = Object.keys(dailyData).sort().slice(-7);
  const consumptions = dates.map((date) => dailyData[date]);

  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#9CA3AF" : "#4B5563";

  if (chart) {
    chart.destroy();
  }

  const ctx = document.getElementById("consumptionChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: dates.map((date) => {
        const [year, month, day] = date.split("-");
        return new Date(year, month - 1, day).toLocaleDateString("fr-FR", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
      }),
      datasets: [
        {
          label: "Consommation (g/jour)",
          data: consumptions,
          backgroundColor: isDark
            ? "rgba(59, 130, 246, 0.5)"
            : "rgba(59, 130, 246, 0.2)",
          borderColor: "#3B82F6",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          },
          ticks: {
            color: textColor,
          },
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: textColor,
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: textColor,
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `Consommation: ${context.raw.toFixed(1)}g`;
            },
          },
        },
      },
    },
  });
}

// Gestion des mesures
function addMeasurement() {
  const remaining = parseFloat(document.getElementById("remaining").value);
  const total = parseFloat(document.getElementById("total").value);
  const measurementDate = document.getElementById("measurementDate").value;

  if (isNaN(remaining) || isNaN(total)) {
    alert("Veuillez entrer des valeurs valides");
    return;
  }

  if (total < remaining) {
    alert(
      "La quantité après remplissage doit être supérieure à la quantité avant remplissage"
    );
    return;
  }

  const timestamp = measurementDate ? new Date(measurementDate) : new Date();

  // Vérification de la chronologie
  const existingMeasurements = measurements.map((m) => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));

  if (
    existingMeasurements.some((m) => Math.abs(m.timestamp - timestamp) < 1000)
  ) {
    alert("Une mesure existe déjà pour ce moment exact");
    return;
  }

  const measurement = {
    id: Date.now(),
    timestamp,
    remaining,
    added: total - remaining,
    total,
    consumed: 0, // Sera recalculé
  };

  measurements.push(measurement);
  recalculateConsumptions();
  updateTable();
  updateStats();
  updateChart();
  clearForm();
}

function deleteMeasurement(id) {
  if (confirm("Êtes-vous sûr de vouloir supprimer cette mesure ?")) {
    measurements = measurements.filter((m) => m.id !== id);
    recalculateConsumptions();
    updateTable();
    updateStats();
    updateChart();
    saveMeasurements();
  }
}

function resetTable() {
  if (
    measurements.length > 0 &&
    confirm(
      "Voulez-vous exporter vos données avant de réinitialiser l'historique ?"
    )
  ) {
    exportData();
  }

  if (
    confirm(
      "Êtes-vous sûr de vouloir réinitialiser tout l'historique ? Cette action est irréversible."
    )
  ) {
    measurements = [];
    saveMeasurements();
    updateTable();
    updateStats();
    updateChart();
  }
}

function updateTable() {
  const tbody = document.querySelector("#measurements");
  tbody.innerHTML = "";

  measurements.forEach((m) => {
    const row = document.createElement("tr");
    row.className =
      "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150";

    const cells = [
      new Date(m.timestamp).toLocaleString("fr-FR"),
      m.remaining.toFixed(1),
      m.total.toFixed(1),
      m.consumed >= 0 ? m.consumed.toFixed(1) : "-",
      `<button 
                onclick="deleteMeasurement(${m.id})" 
                class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
                Supprimer
            </button>`,
    ];

    cells.forEach((cellContent) => {
      const cell = document.createElement("td");
      cell.className =
        "px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400";
      cell.innerHTML = cellContent;
      row.appendChild(cell);
    });

    tbody.appendChild(row);
  });
}

function clearForm() {
  document.getElementById("remaining").value = "";
  document.getElementById("total").value = "";
}

// Fonction pour gérer l'import
async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const importedData = JSON.parse(text);

    // Valider les données
    validateImportedData(importedData);

    // Demander confirmation pour le remplacement ou la fusion
    const action = await showImportDialog();

    if (action === "replace") {
      // Remplacer toutes les données
      measurements = importedData.measurements;
    } else if (action === "merge") {
      // Fusionner en évitant les doublons (basé sur l'ID et le timestamp)
      const existingIds = new Set(measurements.map((m) => m.id));
      const existingTimestamps = new Set(measurements.map((m) => m.timestamp));

      importedData.measurements.forEach((measurement) => {
        if (
          !existingIds.has(measurement.id) &&
          !existingTimestamps.has(measurement.timestamp)
        ) {
          measurements.push(measurement);
        }
      });
    }

    // Sauvegarder et mettre à jour l'interface
    saveMeasurements();
    recalculateConsumptions();
    updateTable();
    updateStats();
    updateChart();

    alert("Import réussi !");
  } catch (error) {
    console.error("Erreur lors de l'import :", error);
    alert(`Erreur lors de l'import : ${error.message}`);
  }

  // Réinitialiser l'input file
  event.target.value = "";
}

// Fonction pour valider le format des données importées
function validateImportedData(data) {
  // Vérifier la version et la structure
  if (!data.version || !data.measurements) {
    throw new Error("Format de fichier invalide");
  }

  // Vérifier chaque mesure
  data.measurements.forEach((measurement, index) => {
    if (
      !measurement.id ||
      !measurement.timestamp ||
      typeof measurement.remaining !== "number" ||
      typeof measurement.total !== "number"
    ) {
      throw new Error(`Mesure invalide à l'index ${index}`);
    }
  });

  return true;
}

// Fonction pour afficher le dialogue de confirmation d'import
function showImportDialog() {
  return new Promise((resolve) => {
    const dialog = document.createElement("div");
    dialog.className =
      "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
    dialog.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Comment souhaitez-vous importer les données ?
                </h3>
                <div class="space-y-4">
                    <button onclick="dialogChoice('replace')" class="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                        Remplacer les données existantes
                    </button>
                    <button onclick="dialogChoice('merge')" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        Fusionner avec les données existantes
                    </button>
                    <button onclick="dialogChoice('cancel')" class="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">
                        Annuler
                    </button>
                </div>
            </div>
        `;

    document.body.appendChild(dialog);

    // Fonction globale pour gérer le choix
    window.dialogChoice = function (choice) {
      document.body.removeChild(dialog);
      resolve(choice);
    };
  });
}

// Ajouter une fonction d'export (utile pour sauvegarder les données)
function exportData() {
  const data = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    measurements: measurements,
    metadata: {
      totalMeasurements: measurements.length,
      firstMeasurement:
        measurements.length > 0
          ? new Date(measurements[0].timestamp).toISOString()
          : null,
      lastMeasurement:
        measurements.length > 0
          ? new Date(
              measurements[measurements.length - 1].timestamp
            ).toISOString()
          : null,
    },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `suivi-croquettes-export-${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Initialisation
document.getElementById("measurementDate").value = new Date()
  .toISOString()
  .slice(0, 16);
recalculateConsumptions();
updateTable();
updateStats();
updateChart();

// Ajouter un gestionnaire d'erreurs de stockage
window.addEventListener("storage", (e) => {
  if (e.key === "catFood") {
    // Recharger les données si elles ont été modifiées dans un autre onglet
    measurements = JSON.parse(localStorage.getItem("catFood")) || [];
    updateTable();
    updateStats();
    updateChart();
  }
});

// Fonction pour générer le PDF
async function exportToPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let yPos = 20;

  // Titre
  doc.setFontSize(20);
  doc.text("Suivi de consommation de croquettes", 20, yPos);
  yPos += 15;

  // Date du rapport
  doc.setFontSize(12);
  doc.text(
    `Rapport généré le : ${new Date().toLocaleDateString("fr-FR")}`,
    20,
    yPos
  );
  yPos += 15;

  // Statistiques principales
  doc.setFontSize(14);
  doc.text("Résumé", 20, yPos);
  yPos += 10;

  // Encadré des statistiques
  doc.setFontSize(12);
  doc.setDrawColor(200, 200, 200);
  doc.rect(20, yPos, 170, 40);

  const dailyData = getDailyConsumption();
  const today = getDateKey(new Date());
  const todayConsumption = dailyData[today] || 0;
  const dates = Object.keys(dailyData).sort();
  const last7Days = dates.slice(-7);
  const weekAvg =
    last7Days.length > 0
      ? last7Days.reduce((sum, date) => sum + dailyData[date], 0) /
        last7Days.length
      : 0;
  const monthTotal = dates
    .filter((date) => new Date(date).getMonth() === new Date().getMonth())
    .reduce((sum, date) => sum + dailyData[date], 0);

  // Ajouter les statistiques dans l'encadré
  yPos += 10;
  doc.text(`Aujourd'hui : ${todayConsumption.toFixed(1)}g`, 30, yPos);
  yPos += 10;
  doc.text(`Moyenne sur 7 jours : ${weekAvg.toFixed(1)}g`, 30, yPos);
  yPos += 10;
  doc.text(`Total du mois : ${monthTotal.toFixed(1)}g`, 30, yPos);
  yPos += 20;

  // Ajouter le graphique
  doc.text("Historique de consommation", 20, yPos);
  yPos += 10;

  // Capturer le graphique existant et le convertir en image
  const canvas = document.getElementById("consumptionChart");
  const chartImage = canvas.toDataURL("image/png");
  doc.addImage(chartImage, "PNG", 20, yPos, 170, 80);
  yPos += 90;

  // Tableau des mesures
  doc.text("Détail des mesures", 20, yPos);
  yPos += 10;

  // Préparer les données pour le tableau
  const tableData = measurements
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((m) => [
      new Date(m.timestamp).toLocaleString("fr-FR"),
      `${m.remaining.toFixed(1)}g`,
      `${m.total.toFixed(1)}g`,
      `${m.consumed >= 0 ? m.consumed.toFixed(1) : "-"}g`,
    ]);

  // Ajouter le tableau
  doc.autoTable({
    startY: yPos,
    head: [
      ["Date et Heure", "Avant remplissage", "Après remplissage", "Consommé"],
    ],
    body: tableData,
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 5,
    },
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 40 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
    },
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(10);
    doc.text(
      `Page ${i} sur ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: "center" }
    );
    doc.text(
      "Généré par MonSuiviCroquettes - Caats",
      20,
      doc.internal.pageSize.height - 10
    );
  }

  // Sauvegarder le PDF
  doc.save(`suivi-croquettes-${new Date().toISOString().split("T")[0]}.pdf`);
}

// Ajouter le bouton d'export PDF dans l'interface
function addPDFExportButton() {
  const buttonContainer = document.querySelector(".space-x-4");
  const pdfButton = document.createElement("button");
  pdfButton.className =
    "px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors duration-200";
  pdfButton.textContent = "Export PDF";
  pdfButton.onclick = exportToPDF;
  buttonContainer.insertBefore(pdfButton, buttonContainer.firstChild);
}

// Appeler cette fonction après le chargement de la page
document.addEventListener("DOMContentLoaded", addPDFExportButton);
