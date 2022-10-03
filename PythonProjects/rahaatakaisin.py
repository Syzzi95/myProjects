def main():
    tuotteenHinta = input("Syötä tuotteen hinta  ")
    annettuRaha = input("Syötä maksettu määrä rahaa  ")
    vaihtoraha = int(annettuRaha) - int(tuotteenHinta)
    print (vaihtoraha)
    if int(tuotteenHinta) >= int(annettuRaha): 
        print ("No change")
    else: 
        print ("Offer change: ")
        setelienmaara = 0

        if  vaihtoraha >= 10: 
            setelienmaara += (vaihtoraha//10)
            vaihtoraha -= setelienmaara*10
            print (str(setelienmaara)," kappaletta"," 10 euron seteliä")
        if  vaihtoraha >= 5: 
            setelienmaara = 0 + (vaihtoraha//5)
            vaihtoraha -=setelienmaara*5
            print (str(setelienmaara), " kappaletta" , " 5 euron seteliä")
        if vaihtoraha >= 2:
            setelienmaara = 0 + (vaihtoraha//2)
            vaihtoraha -=setelienmaara*2  
            print (str(setelienmaara), " kappaletta" , " 2 euron kolikkoa" )
        if vaihtoraha >= 1: 
            setelienmaara = 0 + (vaihtoraha//1)
            vaihtoraha -=setelienmaara
            print (str(setelienmaara), " kappaletta" , " 1 euron kolikkoa" )

main()
