function lerCookie(req, nome) {
	const cabecalho = req.get('Cookie');
	if (!cabecalho) return undefined;

	for (const cookie of cabecalho.split(';')) {
		const separador = cookie.indexOf('=');
		if (separador === -1) continue;

		if (cookie.slice(0, separador).trim() === nome) {
			return cookie.slice(separador + 1).trim();
		}
	}

	return undefined;
}

module.exports = { lerCookie };