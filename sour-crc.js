function make_crc_table(nbits, poly, mask) {
	var crcTable = [];
	var remainder;
	var topbit = 0;
	/*
	 * Count topbit
	 */
	topbit = 1<<(nbits-1);
	poly &= mask;
	/*
	 * Compute the remainder of each possible dividend.
	 */
	for (var dividend = 0; dividend < 256; ++dividend)
	{
		/*
		 * Start with the dividend followed by zeros.
		 */
		remainder = dividend << (nbits - 8);
		/*
		 * Perform modulo-2 division, a bit at a time.
		 */
		for (var bit = 8; bit > 0; --bit)
		{
			/*
			 * Try to divide the current data bit.
			 */	
			if (remainder & topbit)
			{
				remainder = (remainder<<1) ^ poly;
			}
			else
			{
				remainder = (remainder<<1);
			}
			/*
			 * Mask, unsigned
			 */
			remainder &= mask;
			remainder >>>= 0;
		}
		/*
		 * Store the result into the table.
		 */
		crcTable[dividend] = remainder;
	}
	return crcTable;
}

function make_crc_table_reversed(nbits, revpoly, mask) {
	var crcTable = [];
	var remainder;
	revpoly &= mask;
	/*
	 * Compute the remainder of each possible dividend.
	 */
	for (var dividend = 0; dividend < 256; ++dividend)
	{
		/*
		 * Start with the dividend followed by zeros.
		 */
		remainder = dividend;
		/*
		 * Perform modulo-2 division, a bit at a time.
		 */
		for (var bit = 8; bit > 0; --bit)
		{
			/*
			 * Try to divide the current data bit.
			 */	
			if (remainder & 1)
			{
				remainder = (remainder >>> 1) ^ revpoly;
			}
			else
			{
				remainder = (remainder >>> 1);
			}
			/*
			 * Mask, unsigned
			 */
			remainder &= mask;
			remainder >>>= 0;
		}
		/*
		 * Store the result into the table.
		 */
		crcTable[dividend] = remainder;
	}
	return crcTable;
}

function get_sliced(val, curslice) {
	return "0x"+("00000000"+val.toString(16)).slice(curslice);
}

function gen_code_crc(nbits, poly, isrev, isswap, init, final) {
	if(isNaN(nbits) || isNaN(poly) || isNaN(init) || isNaN(final) || nbits<8)
		return "";
	var text = "";
	var ln = "\n";
	var tab = "\t";
	var type = "unsigned " + (nbits <= 8 ? "char" : (nbits <= 16 ? "short" : "long") );
	var curslice = (nbits <= 8 ? -2 : (nbits <= 16 ? -4 : -8) );
	var mask = 0;
	var poly_txt = get_sliced(poly, curslice);
	//count mask
	for(var i=0; i<nbits; i++) {
		mask |= 1<<i;
	}
	//reverse poly if need, count mask
	if(isrev) {
		var temp = 0;
		for(var i=0; i<(nbits-1); i++) {
			if(poly & (1<<i)) {
				temp |= (1<<(nbits-1-i));
			}
		}
		poly = temp>>>0;
	}
	//append header with license
	text += 	"/**"+ln
			+" * This code is generated with sour-crc"+ln
			+" * Provided under the MIT License"+ln
			+" * "+ln
			+" * Copyright (c) "+(new Date().getFullYear())+" Kirill Marinushkin"+ln
			+" * "+ln
			+" * Permission is hereby granted, free of charge, to any person obtaining a copy"+ln
			+" * of this software and associated documentation files (the \"Software\"), to deal"+ln
			+" * in the Software without restriction, including without limitation the rights"+ln
			+" * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell"+ln
			+" * copies of the Software, and to permit persons to whom the Software is"+ln
			+" * furnished to do so, subject to the following conditions:"+ln
			+" * "+ln
			+" * The above copyright notice and this permission notice shall be included in"+ln
			+" * all copies or substantial portions of the Software."+ln
			+" * "+ln
			+" * THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR"+ln
			+" * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,"+ln
			+" * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE"+ln
			+" * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER"+ln
			+" * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,"+ln
			+" * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN"+ln
			+" * THE SOFTWARE."+ln
			+" **/"+ln
			+""+ln
			+type+" crcTable [ ] = {"+ln;
	//append crc lookup table
	var crc_table = [];
	if(isrev)
		crc_table = make_crc_table_reversed(nbits, poly, mask);
	else
		crc_table = make_crc_table(nbits, poly, mask);
	for(var i=0; i<crc_table.length; i++) {
		text += 	(i%8==0 ? tab : "")
				+get_sliced(crc_table[i], curslice)
				+(i<crc_table.length-1 ? ", " : "")
				+(i%8==7 ? ln : "")
			;
	}
	text += 	"};"+ln+ln;
	//append footer with crc() function
	text +=		"/**"+ln
			+" * Calculate CRC"+nbits+" with configuration:"+ln
			+" * polynom: "+poly_txt+ln
			+" * reverse :"+(isrev ? "yes" : "no")+ln
			+" * init value: "+get_sliced(init, curslice)+ln
			+" * xourout value: "+get_sliced(final, curslice)+ln
			+(nbits==16 ? " * swap: "+(isswap ? "yes" : "no")+ln : "")
			+" **/"+ln
			;
	text += 	type+" crc (const unsigned char *data, const unsigned int len)"+ln
			+"{"+ln
			+tab+"unsigned char ind;"+ln
			+tab+"int byte = 0;"+ln
    			+tab+type+" remainder = "+get_sliced(init, curslice)+";"+ln
			+tab+"for (byte = 0; byte < len; ++byte)"+ln
			+tab+"{"+ln;
	if(isrev) {
		//reversed
		text +=	tab+tab+"ind = data[byte] ^ (remainder & 0xff);"+ln
			+tab+tab+"remainder = crcTable[ind] ^ (remainder >> 8);"+ln;
	} else {
		//not inversed
		text +=	tab+tab+"data = data[byte] ^ ((remainder >> "+(nbits-8)+") & 0xFF);"+ln
			+tab+tab+"remainder = crcTable[ind] ^ (remainder << 8);"+ln;
	}
	text +=	tab+"}"+ln;
	if(isswap && nbits == 16) {
		//swap result bytes, exists for crc16 only
		if(final!=0)
			text += tab + "remainder = (remainder"+" ^ "+get_sliced(final, curslice)+");"+ln;
		text += tab+"return ((remainder&0x00FF)<<8) | ((remainder&0xFF00)>>8);"+ln;
	} else {
		text +=	tab+"return (remainder"+(final==0 ? "" : " ^ "+get_sliced(final, curslice))+");"+ln;
	}
	text += "}"+ln;
	return text;
}
