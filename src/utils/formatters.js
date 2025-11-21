export const formatDate = (d) => {
    if (!d || d === "N/A") return "";
    const date = new Date(d);
    return isNaN(date.getTime()) ? d : date.toLocaleDateString('it-IT');
};

    export const formatMoney = (a) => {
    if (!a || a === "N/A") return "";
    const num = parseFloat(a.replace(',', '.'));
    if (isNaN(num) || num === 0) return ""; 
    return num.toFixed(2).replace('.', ',');
};

    export const renderMoneyCell = (amount) => {
    const formatted = formatMoney(amount);
    return formatted ? `${formatted} €` : "";
};